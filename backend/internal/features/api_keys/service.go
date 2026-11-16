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
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"

	users_enums "databasus-backend/internal/features/users/enums"
	users_interfaces "databasus-backend/internal/features/users/interfaces"
	users_models "databasus-backend/internal/features/users/models"
	users_repositories "databasus-backend/internal/features/users/repositories"
	workspaces_repositories "databasus-backend/internal/features/workspaces/repositories"
)

type APIKeyService struct {
	repository           *APIKeyRepository
	userRepository       *users_repositories.UserRepository
	membershipRepository *workspaces_repositories.MembershipRepository
	emailSender          users_interfaces.EmailSender
	logger               *slog.Logger
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

func maskRecipient(recipient string) string {
	parts := strings.Split(recipient, "@")
	if len(parts) == 2 {
		name := parts[0]
		domain := parts[1]
		if len(name) <= 2 {
			return name[:1] + "***@" + domain
		}
		return name[:2] + "***@" + domain
	}
	if len(recipient) > 4 {
		return recipient[:2] + "***" + recipient[len(recipient)-2:]
	}
	return "***"
}

func (s *APIKeyService) RequestOTP(
	ctx context.Context,
	user *users_models.User,
	workspaceID uuid.UUID,
) (*RequestOTPResponse, error) {
	if user.Role == users_enums.UserRoleAdmin {
		return nil, errors.New("super administrators cannot request OTP or generate workspace API keys")
	}

	role, err := s.membershipRepository.GetUserWorkspaceRole(ctx, workspaceID, user.ID)
	if err != nil {
		return nil, err
	}
	if role == nil {
		return nil, errors.New("you are not a member of this workspace")
	}

	if *role != users_enums.WorkspaceRoleOwner && *role != users_enums.WorkspaceRoleAdmin {
		return nil, errors.New("only workspace owners or admins can request API key verification codes")
	}

	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return nil, fmt.Errorf("failed to generate verification code: %w", err)
	}
	code := fmt.Sprintf("%06d", n.Int64()+100000)

	recipient := user.Email
	if user.Phone != nil && *user.Phone != "" {
		recipient = fmt.Sprintf("%s (%s)", user.Email, *user.Phone)
	}

	otp := &APIKeyOTP{
		UserID:      user.ID,
		WorkspaceID: workspaceID,
		Code:        code,
		Recipient:   recipient,
		ExpiresAt:   time.Now().UTC().Add(10 * time.Minute),
		CreatedAt:   time.Now().UTC(),
	}

	if err := s.repository.SaveOTP(ctx, otp); err != nil {
		return nil, fmt.Errorf("failed to store verification code: %w", err)
	}

	subject := fmt.Sprintf("Your Databasus API Key Verification Code: %s", code)
	body := fmt.Sprintf(
		"<p>Hello %s,</p><p>Your verification code to generate an API key is: <strong>%s</strong></p><p>This code expires in 10 minutes. If you did not request this code, please ignore this email.</p>",
		user.Name,
		code,
	)

	if s.emailSender != nil {
		_ = s.emailSender.SendEmail(ctx, user.Email, subject, body)
	}

	s.logger.InfoContext(ctx, "generated API key verification OTP",
		"user_id", user.ID,
		"workspace_id", workspaceID,
		"code", code,
		"recipient", user.Email,
	)

	return &RequestOTPResponse{
		Status:           "sent",
		RecipientMasked:  maskRecipient(user.Email),
		ExpiresInSeconds: 600,
	}, nil
}

func (s *APIKeyService) CreateAPIKey(
	ctx context.Context,
	creator *users_models.User,
	req CreateAPIKeyRequest,
) (*CreateAPIKeyResponse, error) {
	if creator.Role == users_enums.UserRoleAdmin {
		return nil, errors.New("super administrators cannot generate workspace API keys")
	}

	if req.WorkspaceID == nil {
		return nil, errors.New("workspace ID is required")
	}

	role, err := s.membershipRepository.GetUserWorkspaceRole(ctx, *req.WorkspaceID, creator.ID)
	if err != nil {
		return nil, err
	}
	if role == nil {
		return nil, errors.New("insufficient permissions: you are not a member of this workspace")
	}
	if *role != users_enums.WorkspaceRoleOwner && *role != users_enums.WorkspaceRoleAdmin {
		return nil, errors.New("only workspace owners or admins can generate API keys")
	}

	if req.OTP == "" {
		return nil, errors.New("verification OTP is required to generate an API key")
	}

	valid, err := s.repository.VerifyAndConsumeOTP(ctx, creator.ID, *req.WorkspaceID, req.OTP)
	if err != nil {
		return nil, fmt.Errorf("failed to verify OTP: %w", err)
	}
	if !valid {
		return nil, errors.New("invalid or expired verification code")
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

	keyRole := req.Role
	if keyRole == "" {
		keyRole = string(users_enums.WorkspaceRoleAdmin)
	}

	apiKey := &APIKey{
		ID:                uuid.New(),
		Name:              req.Name,
		KeyID:             keyID,
		SecretHash:        s.hashSecret(rawSecret),
		EncryptionKeyHash: s.hashEncryptionKey(rawEncryptionKey),
		WorkspaceID:       req.WorkspaceID,
		UserID:            creator.ID,
		Role:              keyRole,
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
	if user.Role == users_enums.UserRoleAdmin {
		return []*APIKeyResponse{}, nil
	}

	if workspaceID == nil {
		return nil, errors.New("workspace ID is required")
	}

	role, err := s.membershipRepository.GetUserWorkspaceRole(ctx, *workspaceID, user.ID)
	if err != nil {
		return nil, err
	}
	if role == nil {
		return []*APIKeyResponse{}, nil
	}

	keys, err := s.repository.ListByWorkspace(ctx, *workspaceID)
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
	if user.Role == users_enums.UserRoleAdmin {
		return errors.New("super administrators cannot revoke workspace API keys")
	}

	apiKey, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if apiKey == nil {
		return errors.New("API key not found")
	}

	if apiKey.WorkspaceID != nil {
		role, err := s.membershipRepository.GetUserWorkspaceRole(ctx, *apiKey.WorkspaceID, user.ID)
		if err != nil || role == nil {
			return errors.New("insufficient permissions to revoke this API key")
		}
		if *role != users_enums.WorkspaceRoleOwner && *role != users_enums.WorkspaceRoleAdmin && apiKey.UserID != user.ID {
			return errors.New("insufficient permissions to revoke this API key")
		}
	} else if apiKey.UserID != user.ID {
		return errors.New("insufficient permissions to revoke this API key")
	}

	return s.repository.Delete(ctx, id)
}
