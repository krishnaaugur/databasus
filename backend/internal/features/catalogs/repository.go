package catalogs

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"databasus-backend/internal/storage"
)

type TenantCatalogRepository struct{}

func (r *TenantCatalogRepository) Create(ctx context.Context, catalog *TenantCatalog) error {
	if catalog.ID == uuid.Nil {
		catalog.ID = uuid.New()
	}
	return storage.GetDb().WithContext(ctx).Create(catalog).Error
}

func (r *TenantCatalogRepository) FindByID(ctx context.Context, id uuid.UUID) (*TenantCatalog, error) {
	var catalog TenantCatalog
	err := storage.GetDb().WithContext(ctx).Where("id = ?", id).First(&catalog).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &catalog, nil
}

func (r *TenantCatalogRepository) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*TenantCatalog, error) {
	var catalogs []*TenantCatalog
	err := storage.GetDb().WithContext(ctx).
		Where("workspace_id = ?", workspaceID).
		Order("created_at DESC").
		Find(&catalogs).Error
	return catalogs, err
}

func (r *TenantCatalogRepository) Update(ctx context.Context, catalog *TenantCatalog) error {
	return storage.GetDb().WithContext(ctx).Save(catalog).Error
}

func (r *TenantCatalogRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return storage.GetDb().WithContext(ctx).Where("id = ?", id).Delete(&TenantCatalog{}).Error
}

