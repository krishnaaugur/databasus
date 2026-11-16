package users_models

import (
	"time"

	"github.com/google/uuid"
)

type UserInvitation struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID      uuid.UUID  `gorm:"type:uuid;not null" json:"userId"`
	WorkspaceID *uuid.UUID `gorm:"type:uuid" json:"workspaceId,omitempty"`
	Token       string     `gorm:"type:varchar(255);uniqueIndex;not null" json:"token"`
	ExpiresAt   time.Time  `gorm:"not null" json:"expiresAt"`
	CreatedAt   time.Time  `gorm:"not null;default:now()" json:"createdAt"`
}

func (UserInvitation) TableName() string {
	return "user_invitations"
}

func (i *UserInvitation) IsExpired() bool {
	return time.Now().UTC().After(i.ExpiresAt)
}
