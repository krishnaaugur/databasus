# databasus-sdk (Python)

Official Python SDK for **Databasus** automated multi-tenant database backup and restore. Zero external dependencies required (uses standard library `urllib`).

---

## Installation

```bash
pip install databasus-sdk
```

---

## Quickstart

```python
import os
from databasus import DatabasusClient

databasus = DatabasusClient(
    base_url=os.getenv("DATABASUS_URL"), # e.g. "https://databasus-5nzt.onrender.com"
    email=os.getenv("DATABASUS_ADMIN_EMAIL"),
    password=os.getenv("DATABASUS_ADMIN_PASSWORD"),
    default_s3_config={
        "bucket": os.getenv("BACKUP_S3_BUCKET"),
        "region": os.getenv("BACKUP_S3_REGION"),
        "accessKey": os.getenv("BACKUP_S3_ACCESS_KEY"),
        "secretKey": os.getenv("BACKUP_S3_SECRET_KEY"),
        "endpoint": os.getenv("BACKUP_S3_ENDPOINT", ""),
    },
)
```

---

## Core Operations

### 1. Provision a New Tenant
```python
result = databasus.provision_tenant(
    tenant_id="tenant-123",
    tenant_name="Acme Corp",
    database={
        "type": "POSTGRESQL_LOGICAL",
        "host": "tenant-db.internal",
        "port": 5432,
        "database": "tenant_db_123",
        "username": "tenant_user_123",
        "password": "tenant_password_123",
    },
    schedule={"type": "DAILY", "timeOfDay": "02:00"},
    is_backup_enabled=True,
    trigger_initial_backup=True,
)

print("Provisioned:", result)
```

### 2. Tenant Backup Toggle
```python
# Disable backups
databasus.toggle_tenant_backup("tenant-123", is_enabled=False)

# Enable backups
databasus.toggle_tenant_backup("tenant-123", is_enabled=True)
```

### 3. Trigger an On-Demand Backup
```python
databasus.trigger_tenant_backup("tenant-123")
```

### 4. Fetch Backup Status & History
```python
status = databasus.get_tenant_backup_status("tenant-123")
print("Status:", status["lastBackupStatus"])
print("Recent backups:", status["recentBackups"])
```

### 5. Restore Tenant Database
```python
# Restore latest backup
databasus.restore_tenant("tenant-123")
```

### 6. One-Click Bulk Restore (Super Admin)
```python
bulk_result = databasus.restore_workspace_all("tenant-123")
print(f"Restored {bulk_result['restoredCount']} of {bulk_result['totalDatabases']} databases.")
```

