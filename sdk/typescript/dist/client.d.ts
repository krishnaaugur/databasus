import { CentralDbProvisionOptions, DatabaseConnectionConfig, DatabasusClientOptions, TenantBackupStatus, TenantProvisionOptions, TenantProvisionResult, TenantRestoreOptions, WorkspaceBulkRestoreResult } from './types';
export declare function parseDatabaseUrl(urlStr: string): DatabaseConnectionConfig;
export declare class DatabasusClient {
    private readonly baseUrl;
    private readonly email?;
    private readonly password?;
    private readonly defaultS3Config?;
    private authToken?;
    constructor(options: DatabasusClientOptions);
    private request;
    ensureAuthenticated(): Promise<string>;
    ensureCentralDatabaseBackup(options?: CentralDbProvisionOptions): Promise<TenantProvisionResult>;
    getCentralBackupStatus(): Promise<TenantBackupStatus>;
    triggerCentralBackup(): Promise<string>;
    toggleCentralBackup(isEnabled: boolean): Promise<boolean>;
    provisionTenant(options: TenantProvisionOptions): Promise<TenantProvisionResult>;
    toggleTenantBackup(tenantIdentifier: string, isEnabled: boolean): Promise<boolean>;
    triggerTenantBackup(tenantIdentifier: string): Promise<string>;
    getTenantBackupStatus(tenantIdentifier: string): Promise<TenantBackupStatus>;
    restoreTenant(tenantIdentifier: string, options?: TenantRestoreOptions): Promise<{
        status: string;
        message: string;
    }>;
    restoreWorkspaceAll(workspaceIdOrTenantName: string): Promise<WorkspaceBulkRestoreResult>;
    deleteTenant(tenantIdentifier: string): Promise<void>;
    private findOrCreateWorkspace;
    private findOrCreateS3Storage;
    private createTenantDatabase;
    private findOrCreateDatabase;
    private saveBackupConfig;
    private triggerDatabaseBackup;
    private resolveTenantDatabase;
    private resolveWorkspaceId;
}
