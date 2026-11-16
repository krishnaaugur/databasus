-- +goose Up
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

CREATE TABLE IF NOT EXISTS api_key_otps (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_key_otps_user_ws ON api_key_otps(user_id, workspace_id);

-- Ensure tenant members are the owners of their workspaces, not platform super admins
UPDATE workspace_memberships
SET role = 'OWNER'
WHERE id IN (
    SELECT wm.id FROM workspace_memberships wm
    JOIN users u ON wm.user_id = u.id
    WHERE u.role != 'ADMIN'
    AND wm.workspace_id IN (
        SELECT wm2.workspace_id FROM workspace_memberships wm2
        JOIN users u2 ON wm2.user_id = u2.id
        WHERE u2.role = 'ADMIN'
    )
);

DELETE FROM workspace_memberships
WHERE user_id IN (SELECT id FROM users WHERE role = 'ADMIN');

-- +goose Down
DROP TABLE IF EXISTS api_key_otps;
ALTER TABLE users DROP COLUMN IF EXISTS phone;
