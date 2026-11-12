-- +goose Up
-- +goose StatementBegin
ALTER TABLE users_settings
ALTER COLUMN is_member_allowed_to_create_workspaces
SET DEFAULT FALSE;

UPDATE users_settings
SET
    is_member_allowed_to_create_workspaces = FALSE;

-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
ALTER TABLE users_settings
ALTER COLUMN is_member_allowed_to_create_workspaces
SET DEFAULT TRUE;

UPDATE users_settings
SET
    is_member_allowed_to_create_workspaces = TRUE;

-- +goose StatementEnd