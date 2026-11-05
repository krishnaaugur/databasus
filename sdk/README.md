# Databasus Multi-Tenant SDKs & Integration Guide

This directory provides official, zero-dependency SDKs for integrating **Databasus** into any project or SaaS platform for automated database backup and restore.

---

## Available SDKs

| Language / Framework | Directory | Description |
|---|---|---|
| **TypeScript / Node.js** | [`sdk/typescript/`](./typescript) | `@databasus/sdk` for Node.js, Next.js, Express, NestJS, Bun, Deno |
| **Python** | [`sdk/python/`](./python) | `databasus-sdk` for Python (FastAPI, Django, Flask, Celery, Lambda) |
| **Any Language (cURL / HTTP)** | [See Below](#language-agnostic-api-reference) | Standard HTTP JSON requests for Go, Rust, Java, PHP, C# |

---

## Multi-Tenant Architecture Pattern

```
           +-----------------------------------------------+
           |               Your SaaS Backend               |
           +-----------------------------------------------+
                                   |
                Calls Databasus SDK (1-Line Methods)
                                   v
           +-----------------------------------------------+
           |              Databasus Instance               |
           |      (e.g., deployed on Render / Docker)      |
           +-----------------------------------------------+
                    |                              |
      Connects with scoped tenant DB         Dumps & uploads
      credentials (tenant_user_123)          compressed backups
                    v                              v
        [Tenant PostgreSQL DB]          [Central S3 Bucket]
                                        (prefix: tenants/{tenantId}/)
```

---

## 5-Minute Integration Workflow

### 1. Provision a New Tenant
When your application creates a tenant and provisions their database, register it with Databasus:

```typescript
import { DatabasusClient } from '@databasus/sdk';

const databasus = new DatabasusClient({
  baseUrl: process.env.DATABASUS_URL!,
  email: process.env.DATABASUS_ADMIN_EMAIL!,
  password: process.env.DATABASUS_ADMIN_PASSWORD!,
  defaultS3Config: {
    bucket: process.env.BACKUP_S3_BUCKET!,
    region: process.env.BACKUP_S3_REGION!,
    accessKey: process.env.BACKUP_S3_ACCESS_KEY!,
    secretKey: process.env.BACKUP_S3_SECRET_KEY!,
  },
});

// Automatic provisioning:
const result = await databasus.provisionTenant({
  tenantId: tenant.id,
  tenantName: tenant.name,
  database: {
    type: 'POSTGRESQL_LOGICAL',
    host: tenantDbHost,
    port: 5432,
    database: tenantDbName,
    username: tenantDbUser,
    password: tenantDbPassword,
  },
  schedule: { type: 'DAILY', timeOfDay: '02:00' },
  isBackupEnabled: true,
  triggerInitialBackup: true,
});
```

### 2. Tenant Backup Toggle Switch
When an admin toggles backups in the customer portal:

```typescript
await databasus.toggleTenantBackup(tenant.id, isEnabled);
```

### 3. Check Backup Health & Recent Files
To show backup status in the tenant UI:

```typescript
const status = await databasus.getTenantBackupStatus(tenant.id);
// status.isBackupEnabled -> boolean
// status.lastBackupStatus -> 'COMPLETED' | 'FAILED' | 'IN_PROGRESS'
// status.recentBackups   -> Array of backup records (filesize, duration, timestamp)
```

### 4. Restore Tenant Database
```typescript
await databasus.restoreTenant(tenant.id);
```

### 5. One-Click Bulk Restore for Super Admin
Restores every database inside that project's workspace:

```typescript
const bulkResult = await databasus.restoreWorkspaceAll(tenant.id);
console.log(`Restored ${bulkResult.restoredCount} of ${bulkResult.totalDatabases} databases.`);
```

---

## Language-Agnostic API Reference (cURL / HTTP)

If your project is built in Go, Java, C#, or PHP, you can call the underlying REST API directly:

### 1. Authenticate
```bash
curl -X POST "$DATABASUS_URL/api/v1/users/signin" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your_password"}'
```
Returns: `{"token": "<JWT_TOKEN>", "userId": "..."}`

### 2. Create Tenant Workspace
```bash
curl -X POST "$DATABASUS_URL/api/v1/workspaces/create" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "tenant-123"}'
```

### 3. Link Central S3 Storage
```bash
curl -X POST "$DATABASUS_URL/api/v1/storages" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "<WORKSPACE_ID>",
    "type": "S3",
    "name": "S3-tenant-123",
    "s3Storage": {
      "s3Bucket": "my-central-backup-bucket",
      "s3Region": "us-east-1",
      "s3AccessKey": "AKIA...",
      "s3SecretKey": "secret...",
      "s3Prefix": "tenants/tenant-123"
    }
  }'
```

### 4. Register Tenant Database
```bash
curl -X POST "$DATABASUS_URL/api/v1/databases/create" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "<WORKSPACE_ID>",
    "name": "tenant-123-db",
    "type": "POSTGRESQL_LOGICAL",
    "healthStatus": "HEALTHY",
    "postgresqlLogical": {
      "version": "17",
      "host": "postgres.internal",
      "port": 5432,
      "database": "tenant_123",
      "username": "tenant_123_user",
      "password": "tenant_password",
      "sslMode": "disable"
    }
  }'
```

### 5. Trigger Backup
```bash
curl -X POST "$DATABASUS_URL/api/v1/backups" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"databaseId": "<DATABASE_ID>"}'
```

