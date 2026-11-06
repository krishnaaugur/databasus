"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabasusClient = void 0;
exports.parseDatabaseUrl = parseDatabaseUrl;
function parseDatabaseUrl(urlStr) {
    const parsed = new URL(urlStr);
    const sslModeParam = parsed.searchParams.get('sslmode');
    let sslMode = 'disable';
    if (sslModeParam) {
        sslMode = sslModeParam;
    }
    else if (parsed.hostname.includes('neon.tech') ||
        parsed.hostname.includes('aws') ||
        parsed.hostname.includes('supabase')) {
        sslMode = 'require';
    }
    // For Neon, strip -pooler suffix so Databasus connects directly for backups
    const host = parsed.hostname.replace('-pooler', '');
    return {
        type: 'POSTGRES_LOGICAL',
        host,
        port: parsed.port ? parseInt(parsed.port, 10) : 5432,
        database: parsed.pathname.replace(/^\//, '') || 'postgres',
        username: decodeURIComponent(parsed.username || 'postgres'),
        password: decodeURIComponent(parsed.password || ''),
        sslMode,
        version: '17',
        cpuCount: 1,
    };
}
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
    // =========================================================================
    // CENTRAL DATABASE BACKUP & RESTORE
    // =========================================================================
    async ensureCentralDatabaseBackup(options = {}) {
        const projectName = options.projectName || 'Central Database';
        const s3Config = options.s3Storage || this.defaultS3Config;
        if (!s3Config) {
            throw new Error('S3 storage configuration is required for Central DB backup.');
        }
        let dbConfig = options.database;
        if (!dbConfig && options.connectionString) {
            dbConfig = parseDatabaseUrl(options.connectionString);
        }
        if (!dbConfig) {
            const globalProcess = typeof globalThis !== 'undefined'
                ? globalThis.process
                : undefined;
            const connStr = globalProcess && globalProcess.env
                ? globalProcess.env.CENTRAL_DATABASE_URL || globalProcess.env.DATABASE_URL
                : undefined;
            if (connStr) {
                dbConfig = parseDatabaseUrl(connStr);
            }
        }
        if (!dbConfig) {
            throw new Error('Database configuration is required. Set CENTRAL_DATABASE_URL or provide database options.');
        }
        // 1. Find or create central workspace
        const workspace = await this.findOrCreateWorkspace('central-system', projectName);
        // 2. Find or create central S3 storage
        const storage = await this.findOrCreateS3Storage(workspace.id, 'central-db', {
            ...s3Config,
            prefix: s3Config.prefix ? `${s3Config.prefix.replace(/\/+$/, '')}/central-db` : 'central-db',
        });
        // 3. Find or create central database
        const database = await this.findOrCreateDatabase(workspace.id, 'central-database', dbConfig);
        // 4. Save backup schedule (default DAILY at 02:00)
        const isBackupEnabled = options.isBackupEnabled ?? true;
        await this.saveBackupConfig({
            databaseId: database.id,
            storageId: storage.id,
            isBackupEnabled,
            schedule: options.schedule || { type: 'DAILY', timeOfDay: '02:00' },
        });
        // 5. Trigger initial backup snapshot by default
        let initialBackupTriggered = false;
        const shouldTrigger = options.triggerInitialBackup ?? true;
        if (shouldTrigger && isBackupEnabled) {
            try {
                await this.triggerDatabaseBackup(database.id);
                initialBackupTriggered = true;
            }
            catch (error) {
                console.warn('Initial backup trigger for Central DB failed:', error);
            }
        }
        return {
            tenantId: 'central-system',
            workspaceId: workspace.id,
            databaseId: database.id,
            storageId: storage.id,
            isBackupEnabled,
            initialBackupTriggered,
        };
    }
    async getCentralBackupStatus() {
        const workspaceId = await this.resolveWorkspaceId('central-system').catch(() => this.resolveWorkspaceId('Central Database'));
        const databasesRes = await this.request(`/api/v1/databases?workspace_id=${workspaceId}`);
        const databases = Array.isArray(databasesRes)
            ? databasesRes
            : databasesRes?.databases || [];
        const database = databases.find((d) => d.name === 'central-database') || databases[0];
        if (!database) {
            throw new Error('No central database registered in Databasus.');
        }
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
            tenantId: 'central-system',
            workspaceId,
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
    async triggerCentralBackup() {
        const status = await this.getCentralBackupStatus();
        await this.triggerDatabaseBackup(status.databaseId);
        return status.databaseId;
    }
    async toggleCentralBackup(isEnabled) {
        const status = await this.getCentralBackupStatus();
        const currentConfig = await this.request(`/api/v1/backup-configs/database/${status.databaseId}`);
        await this.request('/api/v1/backup-configs/save', {
            method: 'POST',
            body: {
                ...currentConfig,
                databaseId: status.databaseId,
                isBackupsEnabled: isEnabled,
            },
        });
        return isEnabled;
    }
    // =========================================================================
    // TENANT PROVISIONING & BACKUP
    // =========================================================================
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
        const res = await this.request(`/api/v1/databases?workspace_id=${workspaceId}`);
        const workspaceDatabases = Array.isArray(res)
            ? res
            : res?.databases || [];
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
    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================
    async findOrCreateWorkspace(identifier, name) {
        const res = await this.request('/api/v1/workspaces').catch(() => ({ workspaces: [] }));
        const workspaces = res?.workspaces || [];
        const existing = workspaces.find((w) => w.name.toLowerCase() === name.toLowerCase() ||
            w.name.toLowerCase() === identifier.toLowerCase() ||
            w.id === identifier);
        if (existing) {
            return existing;
        }
        const created = await this.request('/api/v1/workspaces', {
            method: 'POST',
            body: {
                name: name || `workspace-${identifier}`,
            },
        });
        return created;
    }
    async findOrCreateS3Storage(workspaceId, storageIdentifier, s3Config) {
        const storagesRes = await this.request(`/api/v1/storages?workspace_id=${workspaceId}`).catch(() => ({ storages: [] }));
        const storageList = Array.isArray(storagesRes)
            ? storagesRes
            : storagesRes?.storages || [];
        const existing = storageList.find((s) => s.name === `S3-${storageIdentifier}` ||
            s.name === storageIdentifier ||
            s.id === storageIdentifier);
        if (existing) {
            return existing;
        }
        const prefix = s3Config.prefix
            ? `${s3Config.prefix.replace(/\/+$/, '')}/${storageIdentifier}`
            : `tenants/${storageIdentifier}`;
        const created = await this.request('/api/v1/storages', {
            method: 'POST',
            body: {
                workspaceId,
                type: 'S3',
                name: `S3-${storageIdentifier}`,
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
        return this.findOrCreateDatabase(workspaceId, `${options.tenantName || options.tenantId}-db`, options.database);
    }
    async findOrCreateDatabase(workspaceId, databaseName, dbConfig) {
        const databasesRes = await this.request(`/api/v1/databases?workspace_id=${workspaceId}`).catch(() => ({ databases: [] }));
        const databaseList = Array.isArray(databasesRes)
            ? databasesRes
            : databasesRes?.databases || [];
        const existing = databaseList.find((d) => d.name === databaseName);
        if (existing) {
            return existing;
        }
        const dbType = dbConfig.type === 'POSTGRESQL_LOGICAL' ? 'POSTGRES_LOGICAL' : dbConfig.type || 'POSTGRES_LOGICAL';
        const payload = {
            workspaceId,
            name: databaseName,
            type: dbType,
            healthStatus: 'AVAILABLE',
        };
        if (dbType === 'POSTGRES_LOGICAL' || dbType === 'POSTGRESQL_LOGICAL') {
            payload['postgresqlLogical'] = {
                version: dbConfig.version || '17',
                host: dbConfig.host,
                port: dbConfig.port || 5432,
                database: dbConfig.database,
                username: dbConfig.username,
                password: dbConfig.password,
                sslMode: dbConfig.sslMode || 'disable',
                cpuCount: dbConfig.cpuCount || 1,
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
                database_id: databaseId,
                databaseId: databaseId,
            },
        });
    }
    async resolveTenantDatabase(tenantIdentifier) {
        const workspaceId = await this.resolveWorkspaceId(tenantIdentifier);
        const res = await this.request(`/api/v1/databases?workspace_id=${workspaceId}`);
        const databases = Array.isArray(res)
            ? res
            : res?.databases || [];
        const match = databases.find((d) => d.id === tenantIdentifier ||
            d.name.toLowerCase().includes(tenantIdentifier.toLowerCase())) || databases[0];
        if (match) {
            return { ...match, workspaceId };
        }
        throw new Error(`No database found in Databasus matching tenant identifier '${tenantIdentifier}'.`);
    }
    async resolveWorkspaceId(identifier) {
        const res = await this.request('/api/v1/workspaces');
        const workspaces = res?.workspaces || [];
        const found = workspaces.find((w) => w.id === identifier ||
            w.name.toLowerCase() === identifier.toLowerCase() ||
            w.name.toLowerCase().includes(identifier.toLowerCase()));
        if (found) {
            return found.id;
        }
        throw new Error(`Workspace not found for identifier '${identifier}'.`);
    }
}
exports.DatabasusClient = DatabasusClient;
