"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabasusClient = void 0;
class DatabasusClient {
    baseUrl;
    email;
    password;
    defaultS3Config;
    authToken;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/+$/, '');
        this.email = options.email;
        this.password = options.password;
        this.authToken = options.token;
        this.defaultS3Config = options.defaultS3Config;
    }
    async request(endpoint, options = {}) {
        const { method = 'GET', body, requiresAuth = true } = options;
        if (requiresAuth) {
            await this.ensureAuthenticated();
        }
        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
        if (this.authToken && requiresAuth) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }
        const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        if (response.status === 401 && requiresAuth && this.email && this.password) {
            this.authToken = undefined;
            await this.ensureAuthenticated();
            headers['Authorization'] = `Bearer ${this.authToken}`;
            const retryResponse = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!retryResponse.ok) {
                const errorText = await retryResponse.text();
                throw new Error(`Databasus API request failed (${retryResponse.status} ${retryResponse.statusText}): ${errorText}`);
            }
            if (retryResponse.status === 204) {
                return undefined;
            }
            return (await retryResponse.json());
        }
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Databasus API request failed (${response.status} ${response.statusText}): ${errorText}`);
        }
        if (response.status === 204) {
            return undefined;
        }
        return (await response.json());
    }
    async ensureAuthenticated() {
        if (this.authToken) {
            return this.authToken;
        }
        if (!this.email || !this.password) {
            throw new Error('DatabasusClient authentication failed: No Bearer token provided, and email/password are missing.');
        }
        const response = await this.request('/api/v1/users/signin', {
            method: 'POST',
            body: {
                email: this.email,
                password: this.password,
            },
            requiresAuth: false,
        });
        if (!response?.token) {
            throw new Error('Databasus sign-in did not return a valid authentication token.');
        }
        this.authToken = response.token;
        return this.authToken;
    }
    async provisionTenant(options) {
        const s3Config = options.s3Storage || this.defaultS3Config;
        if (!s3Config) {
            throw new Error('S3 storage configuration is required. Provide it in provisionTenant or set defaultS3Config on client.');
        }
        const workspace = await this.findOrCreateWorkspace(options.tenantId, options.tenantName);
        const storage = await this.findOrCreateS3Storage(workspace.id, options.tenantId, s3Config);
        const database = await this.createTenantDatabase(workspace.id, options);
        const isBackupEnabled = options.isBackupEnabled ?? true;
        await this.saveBackupConfig({
            databaseId: database.id,
            storageId: storage.id,
            isBackupEnabled,
            schedule: options.schedule || { type: 'DAILY', timeOfDay: '02:00' },
        });
        let initialBackupTriggered = false;
        if (options.triggerInitialBackup && isBackupEnabled) {
            try {
                await this.triggerDatabaseBackup(database.id);
                initialBackupTriggered = true;
            }
            catch (error) {
                console.warn(`Initial backup trigger for tenant ${options.tenantId} failed:`, error);
            }
        }
        return {
            tenantId: options.tenantId,
            workspaceId: workspace.id,
            databaseId: database.id,
            storageId: storage.id,
            isBackupEnabled,
            initialBackupTriggered,
        };
    }
    async toggleTenantBackup(tenantIdentifier, isEnabled) {
        const database = await this.resolveTenantDatabase(tenantIdentifier);
        const currentConfig = await this.request(`/api/v1/backup-configs/database/${database.id}`);
        await this.request('/api/v1/backup-configs/save', {
            method: 'POST',
            body: {
                ...currentConfig,
                databaseId: database.id,
                isBackupsEnabled: isEnabled,
            },
        });
        return isEnabled;
    }
    async triggerTenantBackup(tenantIdentifier) {
        const database = await this.resolveTenantDatabase(tenantIdentifier);
        await this.triggerDatabaseBackup(database.id);
        return database.id;
    }
    async getTenantBackupStatus(tenantIdentifier) {
        const database = await this.resolveTenantDatabase(tenantIdentifier);
        const [backupConfig, backupsResponse] = await Promise.all([
            this.request(`/api/v1/backup-configs/database/${database.id}`).catch(() => ({
                isBackupsEnabled: false,
                backupInterval: { type: 'DAILY', timeOfDay: '02:00' },
            })),
            this.request(`/api/v1/backups?database_id=${database.id}&limit=10&offset=0`).catch(() => ({
                backups: [],
            })),
        ]);
        const recentBackups = (backupsResponse.backups || []).map((b) => ({
            id: b.id,
            databaseId: database.id,
            status: b.status,
            createdAt: b.createdAt,
            durationMs: b.durationMs,
            fileSizeBytes: b.fileSizeBytes,
            errorMessage: b.failMessage,
        }));
        const latestBackup = recentBackups[0];
        return {
            tenantId: tenantIdentifier,
            workspaceId: database.workspaceId,
            databaseId: database.id,
            databaseName: database.name,
            isBackupEnabled: backupConfig.isBackupsEnabled,
            lastBackupTime: latestBackup?.createdAt,
            lastBackupStatus: latestBackup?.status,
            lastBackupErrorMessage: latestBackup?.errorMessage,
            schedule: backupConfig.backupInterval,
            recentBackups,
        };
    }
    async restoreTenant(tenantIdentifier, options = {}) {
        const database = await this.resolveTenantDatabase(tenantIdentifier);
        let backupIdToRestore = options.backupId;
        if (!backupIdToRestore) {
            const backups = await this.request(`/api/v1/backups?database_id=${database.id}&status=COMPLETED&limit=1&offset=0`);
            if (!backups.backups || backups.backups.length === 0) {
                throw new Error(`No completed backup found for tenant ${tenantIdentifier} to restore.`);
            }
            backupIdToRestore = backups.backups[0].id;
        }
        const restorePayload = {};
        if (options.targetDatabase) {
            restorePayload['postgresqlDatabase'] = {
                version: '17',
                host: options.targetDatabase.host,
                port: options.targetDatabase.port || 5432,
                database: options.targetDatabase.database,
                username: options.targetDatabase.username,
                password: options.targetDatabase.password,
                sslMode: options.targetDatabase.sslMode || 'disable',
            };
        }
        const response = await this.request(`/api/v1/restores/${backupIdToRestore}/restore`, {
            method: 'POST',
            body: restorePayload,
        });
        return {
            status: 'started',
            message: response.message || 'Restore process started successfully.',
        };
    }
    async restoreWorkspaceAll(workspaceIdOrTenantName) {
        const workspaceId = await this.resolveWorkspaceId(workspaceIdOrTenantName);
        const databases = await this.request(`/api/v1/databases`);
        const workspaceDatabases = databases.filter((db) => db.workspaceId === workspaceId);
        const results = [];
        let restoredCount = 0;
        let failedCount = 0;
        for (const db of workspaceDatabases) {
            try {
                const backups = await this.request(`/api/v1/backups?database_id=${db.id}&status=COMPLETED&limit=1&offset=0`);
                if (!backups.backups || backups.backups.length === 0) {
                    results.push({
                        databaseId: db.id,
                        databaseName: db.name,
                        backupId: '',
                        status: 'no_backup_found',
                        message: 'No completed backups available to restore.',
                    });
                    continue;
                }
                const latestBackupId = backups.backups[0].id;
                await this.request(`/api/v1/restores/${latestBackupId}/restore`, {
                    method: 'POST',
                    body: {},
                });
                results.push({
                    databaseId: db.id,
                    databaseName: db.name,
                    backupId: latestBackupId,
                    status: 'started',
                    message: 'Restore initiated successfully.',
                });
                restoredCount++;
            }
            catch (err) {
                failedCount++;
                const errorMessage = err instanceof Error ? err.message : String(err);
                results.push({
                    databaseId: db.id,
                    databaseName: db.name,
                    backupId: '',
                    status: 'failed',
                    message: errorMessage,
                });
            }
        }
        return {
            workspaceId,
            totalDatabases: workspaceDatabases.length,
            restoredCount,
            failedCount,
            results,
        };
    }
    async deleteTenant(tenantIdentifier) {
        const workspaceId = await this.resolveWorkspaceId(tenantIdentifier);
        await this.request(`/api/v1/workspaces/${workspaceId}`, {
            method: 'DELETE',
        });
    }
    async findOrCreateWorkspace(tenantId, tenantName) {
        const workspaces = await this.request('/api/v1/workspaces');
        const existing = workspaces.find((w) => w.name === tenantName || w.name === tenantId || w.id === tenantId);
        if (existing) {
            return existing;
        }
        const created = await this.request('/api/v1/workspaces/create', {
            method: 'POST',
            body: {
                name: tenantName || `tenant-${tenantId}`,
            },
        });
        return created;
    }
    async findOrCreateS3Storage(workspaceId, tenantId, s3Config) {
        const storages = await this.request('/api/v1/storages');
        const existing = storages.find((s) => s.workspaceId === workspaceId && s.name === `S3-${tenantId}`);
        if (existing) {
            return existing;
        }
        const prefix = s3Config.prefix
            ? `${s3Config.prefix.replace(/\/+$/, '')}/tenants/${tenantId}`
            : `tenants/${tenantId}`;
        const created = await this.request('/api/v1/storages', {
            method: 'POST',
            body: {
                workspaceId,
                type: 'S3',
                name: `S3-${tenantId}`,
                s3Storage: {
                    s3Bucket: s3Config.bucket,
                    s3Region: s3Config.region,
                    s3AccessKey: s3Config.accessKey,
                    s3SecretKey: s3Config.secretKey,
                    s3Endpoint: s3Config.endpoint || '',
                    s3Prefix: prefix,
                    s3UseVirtualHostedStyle: s3Config.useVirtualHostedStyle ?? false,
                    skipTLSVerify: s3Config.skipTLSVerify ?? false,
                    s3StorageClass: s3Config.storageClass || '',
                },
            },
        });
        return created;
    }
    async createTenantDatabase(workspaceId, options) {
        const dbConfig = options.database;
        const dbType = dbConfig.type || 'POSTGRESQL_LOGICAL';
        const payload = {
            workspaceId,
            name: `${options.tenantName || options.tenantId}-db`,
            type: dbType,
            healthStatus: 'HEALTHY',
        };
        if (dbType === 'POSTGRESQL_LOGICAL') {
            payload['postgresqlLogical'] = {
                version: dbConfig.version || '17',
                host: dbConfig.host,
                port: dbConfig.port || 5432,
                database: dbConfig.database,
                username: dbConfig.username,
                password: dbConfig.password,
                sslMode: dbConfig.sslMode || 'disable',
            };
        }
        const database = await this.request('/api/v1/databases/create', {
            method: 'POST',
            body: payload,
        });
        return database;
    }
    async saveBackupConfig(params) {
        await this.request('/api/v1/backup-configs/save', {
            method: 'POST',
            body: {
                databaseId: params.databaseId,
                storageId: params.storageId,
                isBackupsEnabled: params.isBackupEnabled,
                retentionPolicyType: 'TIME_PERIOD',
                retentionTimePeriod: '30d',
                backupInterval: {
                    type: params.schedule.type,
                    timeOfDay: params.schedule.timeOfDay || '02:00',
                    weekday: params.schedule.weekday,
                    dayOfMonth: params.schedule.dayOfMonth,
                    cronExpression: params.schedule.cronExpression,
                },
                encryption: 'NONE',
                isRetryIfFailed: true,
                maxFailedTriesCount: 3,
            },
        });
    }
    async triggerDatabaseBackup(databaseId) {
        await this.request('/api/v1/backups', {
            method: 'POST',
            body: {
                databaseId,
            },
        });
    }
    async resolveTenantDatabase(tenantIdentifier) {
        const databases = await this.request('/api/v1/databases');
        const directMatch = databases.find((d) => d.id === tenantIdentifier);
        if (directMatch) {
            return directMatch;
        }
        const workspaceId = await this.resolveWorkspaceId(tenantIdentifier);
        const workspaceDb = databases.find((d) => d.workspaceId === workspaceId);
        if (workspaceDb) {
            return workspaceDb;
        }
        throw new Error(`No database found in Databasus matching tenant identifier '${tenantIdentifier}'.`);
    }
    async resolveWorkspaceId(identifier) {
        const workspaces = await this.request('/api/v1/workspaces');
        const found = workspaces.find((w) => w.id === identifier || w.name === identifier);
        if (found) {
            return found.id;
        }
        throw new Error(`Workspace not found for identifier '${identifier}'.`);
    }
}
exports.DatabasusClient = DatabasusClient;
