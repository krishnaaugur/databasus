# @databasus/sdk

Official TypeScript / JavaScript SDK for **Databasus** automated multi-tenant database backup and restore.

## Installation

```bash
npm install @databasus/sdk
# or
pnpm add @databasus/sdk
```

---

## Quickstart

Initialize the client with your Databasus URL and credentials:

```typescript
import { DatabasusClient } from '@databasus/sdk';

const databasus = new DatabasusClient({
  baseUrl: process.env.DATABASUS_URL!, // e.g. "https://databasus-5nzt.onrender.com"
  email: process.env.DATABASUS_ADMIN_EMAIL!,
  password: process.env.DATABASUS_ADMIN_PASSWORD!,
  defaultS3Config: {
    bucket: process.env.BACKUP_S3_BUCKET!,
    region: process.env.BACKUP_S3_REGION!,
    accessKey: process.env.BACKUP_S3_ACCESS_KEY!,
    secretKey: process.env.BACKUP_S3_SECRET_KEY!,
    endpoint: process.env.BACKUP_S3_ENDPOINT, // Optional (for MinIO, Cloudflare R2, etc.)
  },
});
```

---

## Core Operations

### 1. Provision a New Tenant
When your application creates a tenant and provisions their database, register it with Databasus in one call:

```typescript
const result = await databasus.provisionTenant({
  tenantId: 'tenant-123',
  tenantName: 'Acme Corp',
  database: {
    type: 'POSTGRESQL_LOGICAL',
    host: 'tenant-db.internal',
    port: 5432,
    database: 'tenant_db_123',
    username: 'tenant_user_123',
    password: 'tenant_password_123',
  },
  schedule: {
    type: 'DAILY',
    timeOfDay: '02:00', // 2:00 AM UTC
  },
  isBackupEnabled: true,
  triggerInitialBackup: true, // Takes an immediate first backup snapshot
});

console.log('Tenant provisioned in Databasus:', result);
```

### 2. Tenant Backup Toggle
When an admin toggles backups in the tenant dashboard:

```typescript
// Disable backups
await databasus.toggleTenantBackup('tenant-123', false);

// Enable backups
await databasus.toggleTenantBackup('tenant-123', true);
```

### 3. Trigger an On-Demand Backup
When a tenant requests a manual backup before performing migrations or updates:

```typescript
await databasus.triggerTenantBackup('tenant-123');
```

### 4. Fetch Backup Status & History
To display backup health, timestamp, and history in your tenant portal:

```typescript
const status = await databasus.getTenantBackupStatus('tenant-123');

console.log('Backup enabled:', status.isBackupEnabled);
console.log('Last backup time:', status.lastBackupTime);
console.log('Last backup status:', status.lastBackupStatus);
console.log('Recent backup files:', status.recentBackups);
```

### 5. Restore Tenant Database
Restore a tenant's database from their latest backup:

```typescript
// Restore latest backup into original database
await databasus.restoreTenant('tenant-123');

// Or restore into a different/staging database
await databasus.restoreTenant('tenant-123', {
  targetDatabase: {
    host: 'staging-db.internal',
    port: 5432,
    database: 'tenant_staging_123',
    username: 'staging_user',
    password: 'staging_password',
  },
});
```

### 6. One-Click Bulk Restore (Super Admin)
Restore all databases belonging to a workspace/tenant project with one call:

```typescript
const bulkResult = await databasus.restoreWorkspaceAll('tenant-123');

console.log(`Restored ${bulkResult.restoredCount} of ${bulkResult.totalDatabases} databases.`);
```

### 7. Delete Tenant
Clean up workspace, databases, and backup schedules when offboarding a tenant:

```typescript
await databasus.deleteTenant('tenant-123');
```
