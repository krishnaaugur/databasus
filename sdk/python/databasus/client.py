import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional


class DatabasusClient:
    """Official Python Client for Databasus automated multi-tenant database backup and restore."""

    def __init__(
        self,
        base_url: str,
        email: Optional[str] = None,
        password: Optional[str] = None,
        token: Optional[str] = None,
        default_s3_config: Optional[Dict[str, Any]] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.email = email
        self.password = password
        self.auth_token = token
        self.default_s3_config = default_s3_config

    def _request(
        self,
        endpoint: str,
        method: str = "GET",
        body: Optional[Any] = None,
        requires_auth: bool = True,
    ) -> Any:
        if requires_auth:
            self.ensure_authenticated()

        path = endpoint if endpoint.startswith("/") else f"/{endpoint}"
        url = f"{self.base_url}{path}"

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        if self.auth_token and requires_auth:
            headers["Authorization"] = f"Bearer {self.auth_token}"

        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req) as response:
                if response.status == 204:
                    return None
                response_text = response.read().decode("utf-8")
                return json.loads(response_text) if response_text else None
        except urllib.error.HTTPError as error:
            if error.code == 401 and requires_auth and self.email and self.password:
                self.auth_token = None
                self.ensure_authenticated()
                headers["Authorization"] = f"Bearer {self.auth_token}"
                retry_req = urllib.request.Request(url, data=data, headers=headers, method=method)
                with urllib.request.urlopen(retry_req) as retry_resp:
                    if retry_resp.status == 204:
                        return None
                    return json.loads(retry_resp.read().decode("utf-8"))

            error_body = error.read().decode("utf-8")
            raise RuntimeError(
                f"Databasus API request failed ({error.code} {error.reason}): {error_body}"
            ) from error

    def ensure_authenticated(self) -> str:
        if self.auth_token:
            return self.auth_token

        if not self.email or not self.password:
            raise ValueError(
                "DatabasusClient authentication failed: No Bearer token provided, and email/password are missing."
            )

        response = self._request(
            "/api/v1/users/signin",
            method="POST",
            body={"email": self.email, "password": self.password},
            requires_auth=False,
        )

        token = response.get("token") if response else None
        if not token:
            raise RuntimeError("Databasus sign-in did not return a valid authentication token.")

        self.auth_token = token
        return self.auth_token

    def provision_tenant(
        self,
        tenant_id: str,
        tenant_name: str,
        database: Dict[str, Any],
        s3_storage: Optional[Dict[str, Any]] = None,
        schedule: Optional[Dict[str, Any]] = None,
        is_backup_enabled: bool = True,
        trigger_initial_backup: bool = True,
    ) -> Dict[str, Any]:
        s3_config = s3_storage or self.default_s3_config
        if not s3_config:
            raise ValueError(
                "S3 storage configuration is required. Provide s3_storage or set default_s3_config on client."
            )

        workspace = self._find_or_create_workspace(tenant_id, tenant_name)
        storage = self._find_or_create_s3_storage(workspace["id"], tenant_id, s3_config)
        db_record = self._create_tenant_database(workspace["id"], tenant_id, tenant_name, database)

        default_schedule = schedule or {"type": "DAILY", "timeOfDay": "02:00"}
        self._save_backup_config(db_record["id"], storage["id"], is_backup_enabled, default_schedule)

        initial_triggered = False
        if trigger_initial_backup and is_backup_enabled:
            try:
                self._trigger_database_backup(db_record["id"])
                initial_triggered = True
            except Exception as ex:
                print(f"Warning: Initial backup trigger for tenant {tenant_id} failed: {ex}")

        return {
            "tenantId": tenant_id,
            "workspaceId": workspace["id"],
            "databaseId": db_record["id"],
            "storageId": storage["id"],
            "isBackupEnabled": is_backup_enabled,
            "initialBackupTriggered": initial_triggered,
        }

    def toggle_tenant_backup(self, tenant_identifier: str, is_enabled: bool) -> bool:
        database = self._resolve_tenant_database(tenant_identifier)
        current_config = self._request(f"/api/v1/backup-configs/database/{database['id']}")

        current_config["databaseId"] = database["id"]
        current_config["isBackupsEnabled"] = is_enabled

        self._request("/api/v1/backup-configs/save", method="POST", body=current_config)
        return is_enabled

    def trigger_tenant_backup(self, tenant_identifier: str) -> str:
        database = self._resolve_tenant_database(tenant_identifier)
        self._trigger_database_backup(database["id"])
        return database["id"]

    def get_tenant_backup_status(self, tenant_identifier: str) -> Dict[str, Any]:
        database = self._resolve_tenant_database(tenant_identifier)

        try:
            backup_config = self._request(f"/api/v1/backup-configs/database/{database['id']}")
        except Exception:
            backup_config = {"isBackupsEnabled": False, "backupInterval": {"type": "DAILY", "timeOfDay": "02:00"}}

        try:
            backups_resp = self._request(f"/api/v1/backups?database_id={database['id']}&limit=10&offset=0")
            backups = backups_resp.get("backups", [])
        except Exception:
            backups = []

        latest = backups[0] if backups else None

        return {
            "tenantId": tenant_identifier,
            "workspaceId": database.get("workspaceId"),
            "databaseId": database["id"],
            "databaseName": database.get("name"),
            "isBackupEnabled": backup_config.get("isBackupsEnabled", False),
            "lastBackupTime": latest.get("createdAt") if latest else None,
            "lastBackupStatus": latest.get("status") if latest else None,
            "lastBackupErrorMessage": latest.get("failMessage") if latest else None,
            "schedule": backup_config.get("backupInterval"),
            "recentBackups": backups,
        }

    def restore_tenant(
        self,
        tenant_identifier: str,
        backup_id: Optional[str] = None,
        target_database: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        database = self._resolve_tenant_database(tenant_identifier)

        target_backup_id = backup_id
        if not target_backup_id:
            backups_resp = self._request(
                f"/api/v1/backups?database_id={database['id']}&status=COMPLETED&limit=1&offset=0"
            )
            backups = backups_resp.get("backups", [])
            if not backups:
                raise RuntimeError(f"No completed backup found for tenant '{tenant_identifier}' to restore.")
            target_backup_id = backups[0]["id"]

        restore_payload: Dict[str, Any] = {}
        if target_database:
            restore_payload["postgresqlDatabase"] = {
                "version": target_database.get("version", "17"),
                "host": target_database["host"],
                "port": target_database.get("port", 5432),
                "database": target_database["database"],
                "username": target_database["username"],
                "password": target_database["password"],
                "sslMode": target_database.get("sslMode", "disable"),
            }

        response = self._request(
            f"/api/v1/restores/{target_backup_id}/restore",
            method="POST",
            body=restore_payload,
        )

        return {
            "status": "started",
            "message": response.get("message", "Restore process started successfully.") if response else "Restore started.",
        }

    def restore_workspace_all(self, workspace_identifier: str) -> Dict[str, Any]:
        workspace_id = self._resolve_workspace_id(workspace_identifier)
        databases = self._request("/api/v1/databases") or []

        workspace_dbs = [db for db in databases if db.get("workspaceId") == workspace_id]
        results: List[Dict[str, Any]] = []
        restored_count = 0
        failed_count = 0

        for db in workspace_dbs:
            try:
                backups_resp = self._request(
                    f"/api/v1/backups?database_id={db['id']}&status=COMPLETED&limit=1&offset=0"
                )
                backups = backups_resp.get("backups", [])
                if not backups:
                    results.append({
                        "databaseId": db["id"],
                        "databaseName": db.get("name"),
                        "backupId": "",
                        "status": "no_backup_found",
                        "message": "No completed backup available to restore.",
                    })
                    continue

                latest_id = backups[0]["id"]
                self._request(f"/api/v1/restores/{latest_id}/restore", method="POST", body={})
                results.append({
                    "databaseId": db["id"],
                    "databaseName": db.get("name"),
                    "backupId": latest_id,
                    "status": "started",
                    "message": "Restore initiated successfully.",
                })
                restored_count += 1
            except Exception as ex:
                failed_count += 1
                results.append({
                    "databaseId": db["id"],
                    "databaseName": db.get("name"),
                    "backupId": "",
                    "status": "failed",
                    "message": str(ex),
                })

        return {
            "workspaceId": workspace_id,
            "totalDatabases": len(workspace_dbs),
            "restoredCount": restored_count,
            "failedCount": failed_count,
            "results": results,
        }

    def delete_tenant(self, tenant_identifier: str) -> None:
        workspace_id = self._resolve_workspace_id(tenant_identifier)
        self._request(f"/api/v1/workspaces/{workspace_id}", method="DELETE")

    def _find_or_create_workspace(self, tenant_id: str, tenant_name: str) -> Dict[str, Any]:
        workspaces = self._request("/api/v1/workspaces") or []
        for w in workspaces:
            if w.get("name") in (tenant_name, tenant_id) or w.get("id") == tenant_id:
                return w

        return self._request(
            "/api/v1/workspaces/create",
            method="POST",
            body={"name": tenant_name or f"tenant-{tenant_id}"},
        )

    def _find_or_create_s3_storage(
        self, workspace_id: str, tenant_id: str, s3_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        storages = self._request("/api/v1/storages") or []
        expected_name = f"S3-{tenant_id}"
        for s in storages:
            if s.get("workspaceId") == workspace_id and s.get("name") == expected_name:
                return s

        user_prefix = s3_config.get("prefix", "").rstrip("/")
        final_prefix = f"{user_prefix}/tenants/{tenant_id}" if user_prefix else f"tenants/{tenant_id}"

        return self._request(
            "/api/v1/storages",
            method="POST",
            body={
                "workspaceId": workspace_id,
                "type": "S3",
                "name": expected_name,
                "s3Storage": {
                    "s3Bucket": s3_config["bucket"],
                    "s3Region": s3_config["region"],
                    "s3AccessKey": s3_config["accessKey"],
                    "s3SecretKey": s3_config["secretKey"],
                    "s3Endpoint": s3_config.get("endpoint", ""),
                    "s3Prefix": final_prefix,
                    "s3UseVirtualHostedStyle": s3_config.get("useVirtualHostedStyle", False),
                    "skipTLSVerify": s3_config.get("skipTLSVerify", False),
                    "s3StorageClass": s3_config.get("storageClass", ""),
                },
            },
        )

    def _create_tenant_database(
        self,
        workspace_id: str,
        tenant_id: str,
        tenant_name: str,
        db_config: Dict[str, Any],
    ) -> Dict[str, Any]:
        db_type = db_config.get("type", "POSTGRESQL_LOGICAL")
        payload: Dict[str, Any] = {
            "workspaceId": workspace_id,
            "name": f"{tenant_name or tenant_id}-db",
            "type": db_type,
            "healthStatus": "HEALTHY",
        }

        if db_type == "POSTGRESQL_LOGICAL":
            payload["postgresqlLogical"] = {
                "version": db_config.get("version", "17"),
                "host": db_config["host"],
                "port": db_config.get("port", 5432),
                "database": db_config["database"],
                "username": db_config["username"],
                "password": db_config["password"],
                "sslMode": db_config.get("sslMode", "disable"),
            }

        return self._request("/api/v1/databases/create", method="POST", body=payload)

    def _save_backup_config(
        self,
        database_id: str,
        storage_id: str,
        is_enabled: bool,
        schedule: Dict[str, Any],
    ) -> None:
        self._request(
            "/api/v1/backup-configs/save",
            method="POST",
            body={
                "databaseId": database_id,
                "storageId": storage_id,
                "isBackupsEnabled": is_enabled,
                "retentionPolicyType": "TIME_PERIOD",
                "retentionTimePeriod": "30d",
                "backupInterval": {
                    "type": schedule.get("type", "DAILY"),
                    "timeOfDay": schedule.get("timeOfDay", "02:00"),
                    "weekday": schedule.get("weekday"),
                    "dayOfMonth": schedule.get("dayOfMonth"),
                    "cronExpression": schedule.get("cronExpression"),
                },
                "encryption": "NONE",
                "isRetryIfFailed": True,
                "maxFailedTriesCount": 3,
            },
        )

    def _trigger_database_backup(self, database_id: str) -> None:
        self._request("/api/v1/backups", method="POST", body={"databaseId": database_id})

    def _resolve_tenant_database(self, tenant_identifier: str) -> Dict[str, Any]:
        databases = self._request("/api/v1/databases") or []
        for db in databases:
            if db.get("id") == tenant_identifier:
                return db

        workspace_id = self._resolve_workspace_id(tenant_identifier)
        for db in databases:
            if db.get("workspaceId") == workspace_id:
                return db

        raise ValueError(f"No database found in Databasus matching tenant identifier '{tenant_identifier}'.")

    def _resolve_workspace_id(self, identifier: str) -> str:
        workspaces = self._request("/api/v1/workspaces") or []
        for w in workspaces:
            if w.get("id") == identifier or w.get("name") == identifier:
                return w["id"]

        raise ValueError(f"Workspace not found for identifier '{identifier}'.")
