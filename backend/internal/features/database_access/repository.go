package database_access

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"databasus-backend/internal/storage"
)

type DatabaseAccessRepository struct{}

func (r *DatabaseAccessRepository) Upsert(ctx context.Context, entry *DatabaseAccessControl) error {
	db := storage.GetDb().WithContext(ctx)

	var existing DatabaseAccessControl
	var err error
	if entry.UserID != nil {
		err = db.Where("database_id = ? AND user_id = ?", entry.DatabaseID, *entry.UserID).First(&existing).Error
	} else if entry.APIKeyID != nil {
		err = db.Where("database_id = ? AND api_key_id = ?", entry.DatabaseID, *entry.APIKeyID).First(&existing).Error
	} else {
		return errors.New("either userId or apiKeyId must be provided")
	}

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if entry.ID == uuid.Nil {
				entry.ID = uuid.New()
			}
			return db.Create(entry).Error
		}
		return err
	}

	existing.CanView = entry.CanView
	existing.CanBackup = entry.CanBackup
	existing.CanRestore = entry.CanRestore
	existing.CanManage = entry.CanManage
	return db.Save(&existing).Error
}

func (r *DatabaseAccessRepository) FindByDatabaseID(ctx context.Context, databaseID uuid.UUID) ([]*DatabaseAccessControl, error) {
	var records []*DatabaseAccessControl
	err := storage.GetDb().WithContext(ctx).
		Where("database_id = ?", databaseID).
		Find(&records).Error
	return records, err
}

func (r *DatabaseAccessRepository) FindByUserAndDatabase(ctx context.Context, userID, databaseID uuid.UUID) (*DatabaseAccessControl, error) {
	var record DatabaseAccessControl
	err := storage.GetDb().WithContext(ctx).
		Where("database_id = ? AND user_id = ?", databaseID, userID).
		First(&record).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &record, nil
}

func (r *DatabaseAccessRepository) FindByAPIKeyAndDatabase(ctx context.Context, apiKeyID, databaseID uuid.UUID) (*DatabaseAccessControl, error) {
	var record DatabaseAccessControl
	err := storage.GetDb().WithContext(ctx).
		Where("database_id = ? AND api_key_id = ?", databaseID, apiKeyID).
		First(&record).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &record, nil
}

func (r *DatabaseAccessRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return storage.GetDb().WithContext(ctx).Where("id = ?", id).Delete(&DatabaseAccessControl{}).Error
}

func (r *DatabaseAccessRepository) CountByDatabase(ctx context.Context, databaseID uuid.UUID) (int64, error) {
	var count int64
	err := storage.GetDb().WithContext(ctx).
		Model(&DatabaseAccessControl{}).
		Where("database_id = ?", databaseID).
		Count(&count).Error
	return count, err
}

