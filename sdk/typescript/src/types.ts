export type DatabaseType =
  | 'POSTGRES_LOGICAL'
  | 'POSTGRESQL_LOGICAL'
  | 'POSTGRES_PHYSICAL'
  | 'POSTGRESQL_PHYSICAL'
  | 'MYSQL'
  | 'MARIADB'
  | 'MONGODB';

export type IntervalType = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CRON';

export type BackupStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELED';

export interface DatabasusClientOptions {
  baseUrl: string;
  email?: string;
  password?: string;
  token?: string;
  defaultS3Config?: S3StorageConfig;
}

export interface S3StorageConfig {
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
  endpoint?: string;
  prefix?: string;
  useVirtualHostedStyle?: boolean;
  skipTLSVerify?: boolean;
  storageClass?: string;
}

export interface DatabaseConnectionConfig {
  type?: DatabaseType;
  host: string;
  port?: number;
  database: string;
  username: string;
  password: string;
  sslMode?: 'disable' | 'allow' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';
  version?: string;
  cpuCount?: number;
}

export interface BackupScheduleConfig {
  type: IntervalType;
  timeOfDay?: string; // "HH:MM" e.g. "02:00" for DAILY, WEEKLY, MONTHLY
  weekday?: number; // 0-6 (Sunday=0) for WEEKLY
  dayOfMonth?: number; // 1-31 for MONTHLY
  cronExpression?: string; // Standard 5-part cron expression for CRON
}

export interface CentralDbProvisionOptions {
  projectName?: string;
  connectionString?: string;
  database?: DatabaseConnectionConfig;
  s3Storage?: S3StorageConfig;
  schedule?: BackupScheduleConfig;
  isBackupEnabled?: boolean;
  triggerInitialBackup?: boolean;
}

export interface TenantProvisionOptions {
  tenantId: string;
  tenantName: string;
  database: DatabaseConnectionConfig;
  s3Storage?: S3StorageConfig;
  schedule?: BackupScheduleConfig;
  isBackupEnabled?: boolean;
  triggerInitialBackup?: boolean;
}

export interface TenantProvisionResult {
  tenantId: string;
  workspaceId: string;
  databaseId: string;
  storageId: string;
  isBackupEnabled: boolean;
  initialBackupTriggered: boolean;
}

export interface BackupRecord {
  id: string;
  databaseId: string;
  status: BackupStatus;
  createdAt: string;
  durationMs: number;
  fileSizeBytes: number;
  errorMessage?: string;
}

export interface TenantBackupStatus {
  tenantId: string;
  workspaceId: string;
  databaseId: string;
  databaseName: string;
  isBackupEnabled: boolean;
  lastBackupTime?: string;
  lastBackupStatus?: BackupStatus;
  lastBackupErrorMessage?: string;
  schedule?: BackupScheduleConfig;
  recentBackups: BackupRecord[];
}

export interface RestoreTargetConfig {
  host: string;
  port?: number;
  database: string;
  username: string;
  password: string;
  sslMode?: 'disable' | 'allow' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';
  version?: string;
}

export interface TenantRestoreOptions {
  backupId?: string;
  targetDatabase?: RestoreTargetConfig;
}

export interface SingleDatabaseRestoreResult {
  databaseId: string;
  databaseName: string;
  backupId: string;
  status: 'started' | 'failed' | 'no_backup_found';
  message: string;
}

export interface WorkspaceBulkRestoreResult {
  workspaceId: string;
  totalDatabases: number;
  restoredCount: number;
  failedCount: number;
  results: SingleDatabaseRestoreResult[];
}

export interface DatabasusMountOptions {
  tenantId: string;
  apiUrl?: string;
  token?: string;
  email?: string;
  password?: string;
  theme?: 'dark' | 'light' | 'auto';
  title?: string;
  refreshIntervalMs?: number;
  showTriggerBackup?: boolean;
  showRestoreAction?: boolean;
  showScheduleToggle?: boolean;
  onBackupTriggered?: (backupId: string) => void;
  onRestoreTriggered?: (backupId: string) => void;
  onError?: (error: Error) => void;
}

export interface DatabasusWidgetInstance {
  readonly container: HTMLElement;
  readonly shadowRoot: ShadowRoot;
  refresh(): Promise<void>;
  destroy(): void;
}

