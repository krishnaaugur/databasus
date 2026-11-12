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
