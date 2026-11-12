package api_keys

import (
	"time"

	"github.com/google/uuid"
)

type CreateAPIKeyRequest struct {
	Name        string     `json:"name" binding:"required"`
	WorkspaceID *uuid.UUID `json:"workspaceId"`
	Role        string     `json:"role"`
}

type CreateAPIKeyResponse struct {
	ID          uuid.UUID  `json:"id"`
	Name        string     `json:"name"`
	KeyID       string     `json:"keyId"`
	Secret      string     `json:"secret"` // returned only upon creation!
	WorkspaceID *uuid.UUID `json:"workspaceId,omitempty"`
	Role        string     `json:"role"`
	CreatedAt   time.Time  `json:"createdAt"`
}

type APIKeyResponse struct {
	ID          uuid.UUID  `json:"id"`
	Name        string     `json:"name"`
	KeyID       string     `json:"keyId"`
	WorkspaceID *uuid.UUID `json:"workspaceId,omitempty"`
	Role        string     `json:"role"`
	IsActive    bool       `json:"isActive"`
	LastUsedAt  *time.Time `json:"lastUsedAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
}
