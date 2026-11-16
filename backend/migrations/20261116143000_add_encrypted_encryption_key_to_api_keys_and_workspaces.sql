-- +goose Up
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS encrypted_encryption_key TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS encrypted_encryption_key TEXT;

-- +goose Down
ALTER TABLE workspaces DROP COLUMN IF EXISTS encrypted_encryption_key;
ALTER TABLE api_keys DROP COLUMN IF EXISTS encrypted_encryption_key;
