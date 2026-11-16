-- +goose Up

-- 1. Disassociate audit logs from the deleted entities
UPDATE audit_logs
SET workspace_id = NULL
WHERE workspace_id IN (
    SELECT id FROM workspaces
    WHERE LOWER(name) = 'qms'
       OR LOWER(name) LIKE '%qms%'
       OR LOWER(name) LIKE '%multi%tenant%'
);

UPDATE audit_logs
SET user_id = NULL
WHERE user_id IN (
    SELECT id FROM users
    WHERE role != 'ADMIN' AND is_root_admin = FALSE
);

-- 2. Clean up OTPs and security tokens
DELETE FROM api_key_otps
WHERE user_id IN (SELECT id FROM users WHERE role != 'ADMIN' AND is_root_admin = FALSE)
   OR workspace_id IN (
       SELECT id FROM workspaces
       WHERE LOWER(name) = 'qms'
          OR LOWER(name) LIKE '%qms%'
          OR LOWER(name) LIKE '%multi%tenant%'
   );

DELETE FROM two_factor_codes
WHERE user_id IN (SELECT id FROM users WHERE role != 'ADMIN' AND is_root_admin = FALSE);

DELETE FROM password_reset_codes
WHERE user_id IN (SELECT id FROM users WHERE role != 'ADMIN' AND is_root_admin = FALSE);

DELETE FROM download_tokens
WHERE user_id IN (SELECT id FROM users WHERE role != 'ADMIN' AND is_root_admin = FALSE);

-- 3. Clean up database access control
DELETE FROM database_access_control
WHERE user_id IN (SELECT id FROM users WHERE role != 'ADMIN' AND is_root_admin = FALSE);

-- 4. Clean up API keys
DELETE FROM api_keys
WHERE user_id IN (SELECT id FROM users WHERE role != 'ADMIN' AND is_root_admin = FALSE)
   OR workspace_id IN (
       SELECT id FROM workspaces
       WHERE LOWER(name) = 'qms'
          OR LOWER(name) LIKE '%qms%'
          OR LOWER(name) LIKE '%multi%tenant%'
   );

-- 5. Clean up tenant catalogs
DELETE FROM tenant_catalogs
WHERE workspace_id IN (
    SELECT id FROM workspaces
    WHERE LOWER(name) = 'qms'
       OR LOWER(name) LIKE '%qms%'
       OR LOWER(name) LIKE '%multi%tenant%'
);

-- 6. Clean up databases, storages, notifiers in the targeted workspaces
DELETE FROM databases
WHERE workspace_id IN (
    SELECT id FROM workspaces
    WHERE LOWER(name) = 'qms'
       OR LOWER(name) LIKE '%qms%'
       OR LOWER(name) LIKE '%multi%tenant%'
);

DELETE FROM storages
WHERE workspace_id IN (
    SELECT id FROM workspaces
    WHERE LOWER(name) = 'qms'
       OR LOWER(name) LIKE '%qms%'
       OR LOWER(name) LIKE '%multi%tenant%'
);

DELETE FROM notifiers
WHERE workspace_id IN (
    SELECT id FROM workspaces
    WHERE LOWER(name) = 'qms'
       OR LOWER(name) LIKE '%qms%'
       OR LOWER(name) LIKE '%multi%tenant%'
);

-- 7. Clean up workspace memberships
DELETE FROM workspace_memberships
WHERE user_id IN (SELECT id FROM users WHERE role != 'ADMIN' AND is_root_admin = FALSE)
   OR workspace_id IN (
       SELECT id FROM workspaces
       WHERE LOWER(name) = 'qms'
          OR LOWER(name) LIKE '%qms%'
          OR LOWER(name) LIKE '%multi%tenant%'
   );

-- 8. Delete the requested workspaces
DELETE FROM workspaces
WHERE LOWER(name) = 'qms'
   OR LOWER(name) LIKE '%qms%'
   OR LOWER(name) LIKE '%multi%tenant%';

-- 9. Delete all non-admin users
DELETE FROM users
WHERE role != 'ADMIN' AND is_root_admin = FALSE;

-- +goose Down
-- Irreversible cleanup of test data
