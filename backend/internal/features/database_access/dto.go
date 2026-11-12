package database_access

import (
	"time"

	"github.com/google/uuid"
)

type SetDatabaseAccessRequest struct {
	UserID     *uuid.UUID `json:"userId,omitempty"`
	APIKeyID   *uuid.UUID `json:"apiKeyId,omitempty"`
	CanView    bool       `json:"canView"`
	CanBackup  bool       `json:"canBackup"`
	CanRestore bool       `json:"canRestore"`
	CanManage  bool       `json:"canManage"`
}

type DatabaseAccessResponse struct {
	ID           uuid.UUID  `json:"id"`
	DatabaseID   uuid.UUID  `json:"databaseId"`
	UserID       *uuid.UUID `json:"userId,omitempty"`
	UserEmail    *string    `json:"userEmail,omitempty"`
	UserName     *string    `json:"userName,omitempty"`
	APIKeyID     *uuid.UUID `json:"apiKeyId,omitempty"`
	APIKeyName   *string    `json:"apiKeyName,omitempty"`
	APIKeyPublic *string    `json:"apiKeyPublic,omitempty"`
	CanView      bool       `json:"canView"`
	CanBackup    bool       `json:"canBackup"`
	CanRestore   bool       `json:"canRestore"`
	CanManage    bool       `json:"canManage"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

