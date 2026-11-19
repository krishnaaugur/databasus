-- +goose Up
UPDATE users
SET can_create_workspaces = FALSE
WHERE role != 'ADMIN';

UPDATE users_settings
SET is_member_allowed_to_create_workspaces = FALSE;

-- +goose Down
