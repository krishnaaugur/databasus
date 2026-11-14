-- +goose Up
-- +goose StatementBegin
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS encryption_key_hash VARCHAR(255);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE api_keys DROP COLUMN IF EXISTS encryption_key_hash;
-- +goose StatementEnd
