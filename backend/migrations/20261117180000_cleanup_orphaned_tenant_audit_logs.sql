-- +goose Up
-- Clean up orphaned tenant resource audit logs that were disassociated or created without workspace_id
DELETE FROM audit_logs
WHERE workspace_id IS NULL
  AND (
    message LIKE 'Database %'
    OR message LIKE 'Backup %'
    OR message LIKE 'Manual backup %'
    OR message LIKE 'Physical backup %'
    OR message LIKE 'Storage %'
    OR message LIKE 'Notifier %'
    OR message LIKE 'Notification %'
    OR message LIKE 'Restore %'
    OR message LIKE 'Verification run %'
    OR message LIKE 'Verification config %'
  );

-- +goose Down
-- Irreversible cleanup of orphaned audit logs
