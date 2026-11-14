package api_keys

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	users_enums "databasus-backend/internal/features/users/enums"
	users_models "databasus-backend/internal/features/users/models"
	users_repositories "databasus-backend/internal/features/users/repositories"
)

type APIKeyService struct {
	repository     *APIKeyRepository
	userRepository *users_repositories.UserRepository
	logger         *slog.Logger
}

func (s *APIKeyService) hashSecret(secret string) string {
	hash := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(hash[:])
}

func (s *APIKeyService) generateKeyID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "dbs_live_" + hex.EncodeToString(bytes), nil
}

func (s *APIKeyService) generateSecret() (string, error) {
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "dbs_sec_" + hex.EncodeToString(bytes), nil
}

func (s *APIKeyService) generateEncryptionKey() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "dbs_enc_" + hex.EncodeToString(bytes), nil
}

func (s *APIKeyService) hashEncryptionKey(key string) string {
	hash := sha256.Sum256([]byte(key))
	return hex.EncodeToString(hash[:])
}

func (s *APIKeyService) ValidateEncryptionKey(rawKey, expectedHash string) bool {
	if rawKey == "" || expectedHash == "" {
		return false
	}
	hash := s.hashEncryptionKey(rawKey)
	return subtle.ConstantTimeCompare([]byte(hash), []byte(expectedHash)) == 1
}

func (s *APIKeyService) CreateAPIKey(
	ctx context.Context,
	creator *users_models.User,
	req CreateAPIKeyRequest,
) (*CreateAPIKeyResponse, error) {
	if creator.Role != users_enums.UserRoleAdmin && req.WorkspaceID == nil {
		return nil, errors.New("only Super Admin can create platform-wide API keys")
	}

	keyID, err := s.generateKeyID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate key ID: %w", err)
	}

	rawSecret, err := s.generateSecret()
	if err != nil {
		return nil, fmt.Errorf("failed to generate secret: %w", err)
	}

	rawEncryptionKey, err := s.generateEncryptionKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate encryption key: %w", err)
	}

	role := req.Role
	if role == "" {
		role = string(users_enums.WorkspaceRoleAdmin)
	}

	apiKey := &APIKey{
		ID:                uuid.New(),
		Name:              req.Name,
		KeyID:             keyID,
		SecretHash:        s.hashSecret(rawSecret),
		EncryptionKeyHash: s.hashEncryptionKey(rawEncryptionKey),
		WorkspaceID:       req.WorkspaceID,
		UserID:            creator.ID,
		Role:              role,
		Permissions:       "[]",
		IsActive:          true,
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
	}

	if err := s.repository.Create(ctx, apiKey); err != nil {
		return nil, fmt.Errorf("failed to save API key: %w", err)
	}

	s.logger.InfoContext(ctx, "created new API key", "key_id", keyID, "workspace_id", req.WorkspaceID)

	return &CreateAPIKeyResponse{
		ID:            apiKey.ID,
		Name:          apiKey.Name,
		KeyID:         apiKey.KeyID,
		Secret:        rawSecret,
		EncryptionKey: rawEncryptionKey,
		WorkspaceID:   apiKey.WorkspaceID,
		Role:          apiKey.Role,
		CreatedAt:     apiKey.CreatedAt,
	}, nil
}

func (s *APIKeyService) ValidateAPIKey(
	ctx context.Context,
	keyID, secret string,
) (*APIKey, *users_models.User, error) {
	apiKey, err := s.repository.FindByKeyID(ctx, keyID)
	if err != nil {
		return nil, nil, err
	}
	if apiKey == nil || !apiKey.IsActive {
		return nil, nil, errors.New("invalid or inactive API key")
	}

	if apiKey.ExpiresAt != nil && apiKey.ExpiresAt.Before(time.Now().UTC()) {
		return nil, nil, errors.New("API key has expired")
	}

	providedHash := s.hashSecret(secret)
	if subtle.ConstantTimeCompare([]byte(apiKey.SecretHash), []byte(providedHash)) != 1 {
		return nil, nil, errors.New("invalid API secret")
	}

	user, err := s.userRepository.GetUserByID(ctx, apiKey.UserID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get user for API key: %w", err)
	}
	if user == nil {
		return nil, nil, errors.New("user associated with API key not found")
	}

	// Update last used asynchronously so it does not block request path
	go func(id uuid.UUID) {
		_ = s.repository.UpdateLastUsed(context.Background(), id)
	}(apiKey.ID)

	return apiKey, user, nil
}

func (s *APIKeyService) ListAPIKeys(
	ctx context.Context,
	user *users_models.User,
	workspaceID *uuid.UUID,
) ([]*APIKeyResponse, error) {
	var keys []*APIKey
	var err error

	if workspaceID != nil {
		keys, err = s.repository.ListByWorkspace(ctx, *workspaceID)
	} else if user.Role == users_enums.UserRoleAdmin {
		keys, err = s.repository.ListAll(ctx)
	} else {
		return nil, errors.New("workspace ID required for non-admin users")
	}

	if err != nil {
		return nil, err
	}

	res := make([]*APIKeyResponse, 0, len(keys))
	for _, k := range keys {
		res = append(res, &APIKeyResponse{
			ID:          k.ID,
			Name:        k.Name,
			KeyID:       k.KeyID,
			WorkspaceID: k.WorkspaceID,
			Role:        k.Role,
			IsActive:    k.IsActive,
			LastUsedAt:  k.LastUsedAt,
			CreatedAt:   k.CreatedAt,
		})
	}
	return res, nil
}

func (s *APIKeyService) RevokeAPIKey(
	ctx context.Context,
	user *users_models.User,
	id uuid.UUID,
) error {
	apiKey, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if apiKey == nil {
		return errors.New("API key not found")
	}

	if user.Role != users_enums.UserRoleAdmin && apiKey.UserID != user.ID {
		return errors.New("insufficient permissions to revoke this API key")
	}

	return s.repository.Delete(ctx, id)
}

