-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS tenant_catalogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    db_host TEXT NOT NULL,
    db_port INT NOT NULL DEFAULT 5432,
    db_name TEXT NOT NULL,
    db_username TEXT NOT NULL,
    db_password TEXT NOT NULL,
    db_ssl_mode VARCHAR(50) NOT NULL DEFAULT 'require',
    table_name VARCHAR(255) NOT NULL,
    identifier_column VARCHAR(100) NOT NULL DEFAULT 'subdomain',
    host_column VARCHAR(100) NOT NULL DEFAULT 'db_endpoint',
    port_column VARCHAR(100) NOT NULL DEFAULT 'db_port',
    database_column VARCHAR(100) NOT NULL DEFAULT 'db_name',
    user_column VARCHAR(100) NOT NULL DEFAULT 'db_user',
    password_column VARCHAR(100) NOT NULL DEFAULT 'db_password',
    filter_condition TEXT DEFAULT '',
    is_auto_sync_enabled BOOLEAN DEFAULT TRUE,
    sync_interval_minutes INT DEFAULT 15,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(50) DEFAULT 'IDLE',
    last_sync_message TEXT DEFAULT '',
    total_databases_discovered INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_catalogs_workspace_id ON tenant_catalogs(workspace_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS tenant_catalogs;
-- +goose StatementEnd

