package database_access

import (
	"time"

	"github.com/google/uuid"
)

type DatabaseAction string

const (
	ActionView    DatabaseAction = "VIEW"
	ActionBackup  DatabaseAction = "BACKUP"
	ActionRestore DatabaseAction = "RESTORE"
	ActionManage  DatabaseAction = "MANAGE"
)

type DatabaseAccessControl struct {
	ID         uuid.UUID  `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	DatabaseID uuid.UUID  `json:"databaseId" gorm:"type:uuid;not null;index"`
	UserID     *uuid.UUID `json:"userId,omitempty" gorm:"type:uuid;index"`
	APIKeyID   *uuid.UUID `json:"apiKeyId,omitempty" gorm:"type:uuid;index"`
	CanView    bool       `json:"canView" gorm:"not null;default:true"`
	CanBackup  bool       `json:"canBackup" gorm:"not null;default:true"`
	CanRestore bool       `json:"canRestore" gorm:"not null;default:false"`
	CanManage  bool       `json:"canManage" gorm:"not null;default:false"`
	CreatedAt  time.Time  `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt  time.Time  `json:"updatedAt" gorm:"autoUpdateTime"`
}

func (DatabaseAccessControl) TableName() string {
	return "database_access_control"
}

