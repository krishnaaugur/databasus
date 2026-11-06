import {
  BackupRecord,
  BackupScheduleConfig,
  CentralDbProvisionOptions,
  DatabaseConnectionConfig,
  DatabasusClientOptions,
  S3StorageConfig,
  SingleDatabaseRestoreResult,
  TenantBackupStatus,
  TenantProvisionOptions,
  TenantProvisionResult,
  TenantRestoreOptions,
  WorkspaceBulkRestoreResult,
} from './types';

export function parseDatabaseUrl(urlStr: string): DatabaseConnectionConfig {
  const parsed = new URL(urlStr);
  const sslModeParam = parsed.searchParams.get('sslmode');
  let sslMode: DatabaseConnectionConfig['sslMode'] = 'disable';
  if (sslModeParam) {
    sslMode = sslModeParam as DatabaseConnectionConfig['sslMode'];
  } else if (
    parsed.hostname.includes('neon.tech') ||
    parsed.hostname.includes('aws') ||
    parsed.hostname.includes('supabase')
  ) {
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

export class DatabasusClient {
  private readonly baseUrl: string;
  private readonly email?: string;
  private readonly password?: string;
  private readonly defaultS3Config?: S3StorageConfig;
  private authToken?: string;

  constructor(options: DatabasusClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.email = options.email;
    this.password = options.password;
    this.authToken = options.token;
    this.defaultS3Config = options.defaultS3Config;
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      body?: unknown;
      requiresAuth?: boolean;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, requiresAuth = true } = options;

    if (requiresAuth) {
      await this.ensureAuthenticated();
    }

    const headers: Record<string, string> = {
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
        throw new Error(
          `Databasus API request failed (${retryResponse.status} ${retryResponse.statusText}): ${errorText}`
        );
      }

      if (retryResponse.status === 204) {
        return undefined as T;
      }
      return (await retryResponse.json()) as T;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Databasus API request failed (${response.status} ${response.statusText}): ${errorText}`
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  public async ensureAuthenticated(): Promise<string> {
    if (this.authToken) {
      return this.authToken;
    }

    if (!this.email || !this.password) {
      throw new Error(
        'DatabasusClient authentication failed: No Bearer token provided, and email/password are missing.'
      );
    }

    interface SignInResponse {
      token: string;
      userId: string;
    }

    const response = await this.request<SignInResponse>('/api/v1/users/signin', {
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

  public async ensureCentralDatabaseBackup(
    options: CentralDbProvisionOptions = {}
  ): Promise<TenantProvisionResult> {
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
      const globalProcess =
        typeof globalThis !== 'undefined'
          ? ((globalThis as Record<string, unknown>).process as
              | { env?: Record<string, string | undefined> }
              | undefined)
          : undefined;
      const connStr =
        globalProcess && globalProcess.env
          ? globalProcess.env.CENTRAL_DATABASE_URL || globalProcess.env.DATABASE_URL
          : undefined;
      if (connStr) {
        dbConfig = parseDatabaseUrl(connStr);
      }
    }

    if (!dbConfig) {
      throw new Error(
        'Database configuration is required. Set CENTRAL_DATABASE_URL or provide database options.'
      );
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
      } catch (error) {
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

  public async getCentralBackupStatus(): Promise<TenantBackupStatus> {
    const workspaceId = await this.resolveWorkspaceId('central-system').catch(() =>
      this.resolveWorkspaceId('Central Database')
    );

    const databasesRes = await this.request<{
      databases?: Array<{ id: string; name: string }>;
    }>(`/api/v1/databases?workspace_id=${workspaceId}`);
    const databases: Array<{ id: string; name: string }> = Array.isArray(databasesRes)
      ? (databasesRes as Array<{ id: string; name: string }>)
      : databasesRes?.databases || [];

    const database = databases.find((d) => d.name === 'central-database') || databases[0];
    if (!database) {
      throw new Error('No central database registered in Databasus.');
    }

    const [backupConfig, backupsResponse] = await Promise.all([
      this.request<{
        isBackupsEnabled: boolean;
        backupInterval: BackupScheduleConfig;
      }>(`/api/v1/backup-configs/database/${database.id}`).catch(() => ({
        isBackupsEnabled: false,
        backupInterval: { type: 'DAILY' as const, timeOfDay: '02:00' },
      })),
      this.request<{
        backups: Array<{
          id: string;
          status: string;
          createdAt: string;
          durationMs: number;
          fileSizeBytes: number;
          failMessage?: string;
        }>;
      }>(`/api/v1/backups?database_id=${database.id}&limit=10&offset=0`).catch(() => ({
        backups: [],
      })),
    ]);

    const recentBackups: BackupRecord[] = (backupsResponse.backups || []).map((b) => ({
      id: b.id,
      databaseId: database.id,
      status: b.status as BackupRecord['status'],
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

  public async triggerCentralBackup(): Promise<string> {
    const status = await this.getCentralBackupStatus();
    await this.triggerDatabaseBackup(status.databaseId);
    return status.databaseId;
  }

  public async toggleCentralBackup(isEnabled: boolean): Promise<boolean> {
    const status = await this.getCentralBackupStatus();
    const currentConfig = await this.request<Record<string, unknown>>(
      `/api/v1/backup-configs/database/${status.databaseId}`
    );

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

  public async provisionTenant(
    options: TenantProvisionOptions
  ): Promise<TenantProvisionResult> {
    const s3Config = options.s3Storage || this.defaultS3Config;
    if (!s3Config) {
      throw new Error(
        'S3 storage configuration is required. Provide it in provisionTenant or set defaultS3Config on client.'
      );
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
      } catch (error) {
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

  public async toggleTenantBackup(
    tenantIdentifier: string,
    isEnabled: boolean
  ): Promise<boolean> {
    const database = await this.resolveTenantDatabase(tenantIdentifier);
    const currentConfig = await this.request<Record<string, unknown>>(
      `/api/v1/backup-configs/database/${database.id}`
    );

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

  public async triggerTenantBackup(tenantIdentifier: string): Promise<string> {
    const database = await this.resolveTenantDatabase(tenantIdentifier);
    await this.triggerDatabaseBackup(database.id);
    return database.id;
  }

  public async getTenantBackupStatus(
    tenantIdentifier: string
  ): Promise<TenantBackupStatus> {
    const database = await this.resolveTenantDatabase(tenantIdentifier);

    const [backupConfig, backupsResponse] = await Promise.all([
      this.request<{
        isBackupsEnabled: boolean;
        backupInterval: BackupScheduleConfig;
      }>(`/api/v1/backup-configs/database/${database.id}`).catch(() => ({
        isBackupsEnabled: false,
        backupInterval: { type: 'DAILY' as const, timeOfDay: '02:00' },
      })),
      this.request<{
        backups: Array<{
          id: string;
          status: string;
          createdAt: string;
          durationMs: number;
          fileSizeBytes: number;
          failMessage?: string;
        }>;
      }>(`/api/v1/backups?database_id=${database.id}&limit=10&offset=0`).catch(() => ({
        backups: [],
      })),
    ]);

    const recentBackups: BackupRecord[] = (backupsResponse.backups || []).map((b) => ({
      id: b.id,
      databaseId: database.id,
      status: b.status as BackupRecord['status'],
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

  public async restoreTenant(
    tenantIdentifier: string,
    options: TenantRestoreOptions = {}
  ): Promise<{ status: string; message: string }> {
    const database = await this.resolveTenantDatabase(tenantIdentifier);

    let backupIdToRestore = options.backupId;
    if (!backupIdToRestore) {
      const backups = await this.request<{
        backups: Array<{ id: string; status: string }>;
      }>(`/api/v1/backups?database_id=${database.id}&status=COMPLETED&limit=1&offset=0`);

      if (!backups.backups || backups.backups.length === 0) {
        throw new Error(`No completed backup found for tenant ${tenantIdentifier} to restore.`);
      }

      backupIdToRestore = backups.backups[0].id;
    }

    const restorePayload: Record<string, unknown> = {};
    if (options.targetDatabase) {
      restorePayload['postgresqlDatabase'] = {
        version: options.targetDatabase.version || '18',
        host: options.targetDatabase.host,
        port: options.targetDatabase.port || 5432,
        database: options.targetDatabase.database,
        username: options.targetDatabase.username,
        password: options.targetDatabase.password,
        sslMode: options.targetDatabase.sslMode || 'require',
      };
    }

    const response = await this.request<{ message: string }>(
      `/api/v1/restores/${backupIdToRestore}/restore`,
      {
        method: 'POST',
        body: restorePayload,
      }
    );

    return {
      status: 'started',
      message: response.message || 'Restore process started successfully.',
    };
  }

  public async restoreWorkspaceAll(
    workspaceIdOrTenantName: string
  ): Promise<WorkspaceBulkRestoreResult> {
    const workspaceId = await this.resolveWorkspaceId(workspaceIdOrTenantName);

    const res = await this.request<{
      databases?: Array<{ id: string; name: string; workspaceId: string }>;
    }>(`/api/v1/databases?workspace_id=${workspaceId}`);
    const workspaceDatabases: Array<{ id: string; name: string; workspaceId: string }> = Array.isArray(res)
      ? (res as Array<{ id: string; name: string; workspaceId: string }>)
      : res?.databases || [];

    const results: SingleDatabaseRestoreResult[] = [];
    let restoredCount = 0;
    let failedCount = 0;

    for (const db of workspaceDatabases) {
      try {
        const backups = await this.request<{
          backups: Array<{ id: string; status: string }>;
        }>(`/api/v1/backups?database_id=${db.id}&status=COMPLETED&limit=1&offset=0`);

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
      } catch (err: unknown) {
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

  public async deleteTenant(tenantIdentifier: string): Promise<void> {
    const workspaceId = await this.resolveWorkspaceId(tenantIdentifier);
    await this.request(`/api/v1/workspaces/${workspaceId}`, {
      method: 'DELETE',
    });
  }

  // =========================================================================
  // INTERNAL HELPERS
  // =========================================================================

  private async findOrCreateWorkspace(
    identifier: string,
    name: string
  ): Promise<{ id: string; name: string }> {
    const res = await this.request<{ workspaces: Array<{ id: string; name: string }> }>(
      '/api/v1/workspaces'
    ).catch(() => ({ workspaces: [] }));

    const workspaces = res?.workspaces || [];

    const existing = workspaces.find(
      (w) =>
        w.name.toLowerCase() === name.toLowerCase() ||
        w.name.toLowerCase() === identifier.toLowerCase() ||
        w.id === identifier
    );

    if (existing) {
      return existing;
    }

    const created = await this.request<{ id: string; name: string }>('/api/v1/workspaces', {
      method: 'POST',
      body: {
        name: name || `workspace-${identifier}`,
      },
    });

    return created;
  }

  private async findOrCreateS3Storage(
    workspaceId: string,
    storageIdentifier: string,
    s3Config: S3StorageConfig
  ): Promise<{ id: string }> {
    const storagesRes = await this.request<{
      storages?: Array<{ id: string; name: string }>;
    }>(`/api/v1/storages?workspace_id=${workspaceId}`).catch(() => ({ storages: [] }));

    const storageList: Array<{ id: string; name: string }> = Array.isArray(storagesRes)
      ? (storagesRes as Array<{ id: string; name: string }>)
      : storagesRes?.storages || [];

    const existing = storageList.find(
      (s) =>
        s.name === `S3-${storageIdentifier}` ||
        s.name === storageIdentifier ||
        s.id === storageIdentifier
    );

    if (existing) {
      return existing;
    }

    const prefix = s3Config.prefix
      ? `${s3Config.prefix.replace(/\/+$/, '')}/${storageIdentifier}`
      : `tenants/${storageIdentifier}`;

    let endpoint = s3Config.endpoint || '';
    if (endpoint) {
      if (endpoint.includes('amazonaws.com')) {
        endpoint = '';
      } else {
        endpoint = endpoint.replace(/^https?:\/\//, '').split('/')[0];
      }
    }

    const created = await this.request<{ id: string }>('/api/v1/storages', {
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
          s3Endpoint: endpoint,
          s3Prefix: prefix,
          s3UseVirtualHostedStyle: s3Config.useVirtualHostedStyle ?? false,
          skipTLSVerify: s3Config.skipTLSVerify ?? false,
          s3StorageClass: s3Config.storageClass || '',
        },
      },
    });

    return created;
  }

  private async createTenantDatabase(
    workspaceId: string,
    options: TenantProvisionOptions
  ): Promise<{ id: string }> {
    return this.findOrCreateDatabase(
      workspaceId,
      `${options.tenantName || options.tenantId}-db`,
      options.database
    );
  }

  private async findOrCreateDatabase(
    workspaceId: string,
    databaseName: string,
    dbConfig: DatabaseConnectionConfig
  ): Promise<{ id: string; name: string }> {
    const databasesRes = await this.request<{
      databases?: Array<{ id: string; name: string }>;
    }>(`/api/v1/databases?workspace_id=${workspaceId}`).catch(() => ({ databases: [] }));

    const databaseList: Array<{ id: string; name: string }> = Array.isArray(databasesRes)
      ? (databasesRes as Array<{ id: string; name: string }>)
      : databasesRes?.databases || [];

    const existing = databaseList.find((d) => d.name === databaseName);
    if (existing) {
      return existing;
    }

    const dbType =
      dbConfig.type === 'POSTGRESQL_LOGICAL' ? 'POSTGRES_LOGICAL' : dbConfig.type || 'POSTGRES_LOGICAL';

    const payload: Record<string, unknown> = {
      workspaceId,
      name: databaseName,
      type: dbType,
      healthStatus: 'AVAILABLE',
    };

    if (dbType === 'POSTGRES_LOGICAL' || (dbType as string) === 'POSTGRESQL_LOGICAL') {
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

    const database = await this.request<{ id: string; name: string }>('/api/v1/databases/create', {
      method: 'POST',
      body: payload,
    });

    return database;
  }

  private async saveBackupConfig(params: {
    databaseId: string;
    storageId: string;
    isBackupEnabled: boolean;
    schedule: BackupScheduleConfig;
  }): Promise<void> {
    await this.request('/api/v1/backup-configs/save', {
      method: 'POST',
      body: {
        databaseId: params.databaseId,
        storageId: params.storageId,
        storage: { id: params.storageId },
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

  private async triggerDatabaseBackup(databaseId: string): Promise<void> {
    await this.request('/api/v1/backups', {
      method: 'POST',
      body: {
        database_id: databaseId,
        databaseId: databaseId,
      },
    });
  }

  private async resolveTenantDatabase(tenantIdentifier: string): Promise<{
    id: string;
    name: string;
    workspaceId: string;
  }> {
    const workspaceId = await this.resolveWorkspaceId(tenantIdentifier);

    const res = await this.request<{
      databases?: Array<{ id: string; name: string; workspaceId: string }>;
    }>(`/api/v1/databases?workspace_id=${workspaceId}`);
    const databases: Array<{ id: string; name: string; workspaceId: string }> = Array.isArray(res)
      ? (res as Array<{ id: string; name: string; workspaceId: string }>)
      : res?.databases || [];

    const match =
      databases.find(
        (d) =>
          d.id === tenantIdentifier ||
          d.name.toLowerCase().includes(tenantIdentifier.toLowerCase())
      ) || databases[0];

    if (match) {
      return { ...match, workspaceId };
    }

    throw new Error(
      `No database found in Databasus matching tenant identifier '${tenantIdentifier}'.`
    );
  }

  private async resolveWorkspaceId(identifier: string): Promise<string> {
    const res = await this.request<{ workspaces: Array<{ id: string; name: string }> }>(
      '/api/v1/workspaces'
    );
    const workspaces = res?.workspaces || [];

    const found = workspaces.find(
      (w) =>
        w.id === identifier ||
        w.name.toLowerCase() === identifier.toLowerCase() ||
        w.name.toLowerCase().includes(identifier.toLowerCase())
    );
    if (found) {
      return found.id;
    }

    throw new Error(`Workspace not found for identifier '${identifier}'.`);
  }
}
