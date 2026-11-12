-- +goose Up
-- +goose StatementBegin

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    key_id VARCHAR(64) NOT NULL,
    secret_hash VARCHAR(255) NOT NULL,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'WORKSPACE_ADMIN',
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys (key_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_id ON api_keys (workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS api_keys;

-- +goose StatementEnd
