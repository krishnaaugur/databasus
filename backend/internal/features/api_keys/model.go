package api_keys

import (
	"time"

	"github.com/google/uuid"
)

type APIKey struct {
	ID          uuid.UUID  `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Name        string     `json:"name" gorm:"type:varchar(255);not null"`
	KeyID             string     `json:"keyId" gorm:"type:varchar(64);uniqueIndex;not null"`
	SecretHash        string     `json:"-" gorm:"type:varchar(255);not null"`
	EncryptionKeyHash string     `json:"-" gorm:"type:varchar(255)"`
	WorkspaceID *uuid.UUID `json:"workspaceId,omitempty" gorm:"type:uuid;index"`
	UserID      uuid.UUID  `json:"userId" gorm:"type:uuid;index;not null"`
	Role        string     `json:"role" gorm:"type:varchar(50);not null;default:'WORKSPACE_ADMIN'"`
	Permissions string     `json:"permissions" gorm:"type:jsonb;default:'[]'"`
	IsActive    bool       `json:"isActive" gorm:"default:true"`
	ExpiresAt   *time.Time `json:"expiresAt,omitempty"`
	LastUsedAt  *time.Time `json:"lastUsedAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt   time.Time  `json:"updatedAt" gorm:"autoUpdateTime"`
}

func (APIKey) TableName() string {
	return "api_keys"
}

type APIKeyOTP struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID      uuid.UUID `json:"userId" gorm:"type:uuid;index;not null"`
	WorkspaceID uuid.UUID `json:"workspaceId" gorm:"type:uuid;index;not null"`
	Code        string    `json:"code" gorm:"type:varchar(10);not null"`
	Recipient   string    `json:"recipient" gorm:"type:varchar(255);not null"`
	ExpiresAt   time.Time `json:"expiresAt" gorm:"not null"`
	CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`
}

func (APIKeyOTP) TableName() string {
	return "api_key_otps"
}

