-- +goose Up
-- +goose StatementBegin

CREATE TABLE IF NOT EXISTS database_access_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    can_view BOOLEAN NOT NULL DEFAULT TRUE,
    can_backup BOOLEAN NOT NULL DEFAULT TRUE,
    can_restore BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_dac_principal CHECK (
        (user_id IS NOT NULL AND api_key_id IS NULL) OR 
        (user_id IS NULL AND api_key_id IS NOT NULL)
    ),
    CONSTRAINT uq_dac_db_user UNIQUE (database_id, user_id),
    CONSTRAINT uq_dac_db_api_key UNIQUE (database_id, api_key_id)
);

CREATE INDEX IF NOT EXISTS idx_dac_database_id ON database_access_control (database_id);
CREATE INDEX IF NOT EXISTS idx_dac_user_id ON database_access_control (user_id);
CREATE INDEX IF NOT EXISTS idx_dac_api_key_id ON database_access_control (api_key_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS database_access_control;

-- +goose StatementEnd

