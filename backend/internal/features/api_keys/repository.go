package api_keys

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"databasus-backend/internal/storage"
)

type APIKeyRepository struct{}

func (r *APIKeyRepository) Create(ctx context.Context, apiKey *APIKey) error {
	if apiKey.ID == uuid.Nil {
		apiKey.ID = uuid.New()
	}
	return storage.GetDb().WithContext(ctx).Create(apiKey).Error
}

func (r *APIKeyRepository) FindByKeyID(ctx context.Context, keyID string) (*APIKey, error) {
	var apiKey APIKey
	err := storage.GetDb().WithContext(ctx).
		Where("key_id = ? AND is_active = ?", keyID, true).
		First(&apiKey).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &apiKey, nil
}

func (r *APIKeyRepository) FindByID(ctx context.Context, id uuid.UUID) (*APIKey, error) {
	var apiKey APIKey
	err := storage.GetDb().WithContext(ctx).Where("id = ?", id).First(&apiKey).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &apiKey, nil
}

func (r *APIKeyRepository) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*APIKey, error) {
	var keys []*APIKey
	err := storage.GetDb().WithContext(ctx).
		Where("workspace_id = ?", workspaceID).
		Order("created_at DESC").
		Find(&keys).Error
	return keys, err
}

func (r *APIKeyRepository) GetFirstActiveByWorkspaceID(ctx context.Context, workspaceID uuid.UUID) (*APIKey, error) {
	var apiKey APIKey

	err := storage.GetDb().WithContext(ctx).
		Where("workspace_id = ? AND is_active = ? AND encrypted_encryption_key IS NOT NULL AND encrypted_encryption_key != ''", workspaceID, true).
		Order("created_at DESC").
		First(&apiKey).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return &apiKey, nil
}

func (r *APIKeyRepository) ListAll(ctx context.Context) ([]*APIKey, error) {
	var keys []*APIKey
	err := storage.GetDb().WithContext(ctx).
		Order("created_at DESC").
		Find(&keys).Error
	return keys, err
}

func (r *APIKeyRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return storage.GetDb().WithContext(ctx).Where("id = ?", id).Delete(&APIKey{}).Error
}

func (r *APIKeyRepository) UpdateLastUsed(ctx context.Context, id uuid.UUID) error {
	now := time.Now().UTC()
	return storage.GetDb().WithContext(ctx).
		Model(&APIKey{}).
		Where("id = ?", id).
		Update("last_used_at", &now).Error
}

func (r *APIKeyRepository) SaveOTP(ctx context.Context, otp *APIKeyOTP) error {
	if otp.ID == uuid.Nil {
		otp.ID = uuid.New()
	}
	_ = storage.GetDb().WithContext(ctx).
		Where("user_id = ? AND workspace_id = ?", otp.UserID, otp.WorkspaceID).
		Delete(&APIKeyOTP{}).Error

	return storage.GetDb().WithContext(ctx).Create(otp).Error
}

func (r *APIKeyRepository) VerifyAndConsumeOTP(ctx context.Context, userID, workspaceID uuid.UUID, code string) (bool, error) {
	var otp APIKeyOTP
	err := storage.GetDb().WithContext(ctx).
		Where("user_id = ? AND workspace_id = ? AND code = ? AND expires_at > ?", userID, workspaceID, code, time.Now().UTC()).
		First(&otp).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}

	_ = storage.GetDb().WithContext(ctx).Where("id = ?", otp.ID).Delete(&APIKeyOTP{}).Error
	return true, nil
}

