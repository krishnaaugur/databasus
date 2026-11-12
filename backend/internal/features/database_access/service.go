package database_access

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/google/uuid"

	"databasus-backend/internal/features/api_keys"
	users_enums "databasus-backend/internal/features/users/enums"
	users_models "databasus-backend/internal/features/users/models"
	users_repositories "databasus-backend/internal/features/users/repositories"
	workspaces_services "databasus-backend/internal/features/workspaces/services"
)

type DatabaseAccessService struct {
	repository       *DatabaseAccessRepository
	userRepository   *users_repositories.UserRepository
	apiKeyRepository *api_keys.APIKeyRepository
	workspaceService *workspaces_services.WorkspaceService
	logger           *slog.Logger
}

func (s *DatabaseAccessService) CanAccess(
	ctx context.Context,
	user *users_models.User,
	apiKey *api_keys.APIKey,
	workspaceID *uuid.UUID,
	databaseID uuid.UUID,
	action DatabaseAction,
) (bool, error) {
	// 1. Super Admin has unrestricted access everywhere
	if user != nil && user.Role == users_enums.UserRoleAdmin {
		return true, nil
	}

	// 2. Check workspace-level access first
	if workspaceID != nil {
		if user != nil {
			canAccess, role, err := s.workspaceService.CanUserAccessWorkspace(ctx, *workspaceID, user)
			if err != nil {
				return false, err
			}
			if !canAccess {
				return false, nil
			}

			// Workspace Owner has full access to all databases inside their workspace
			if role != nil && *role == users_enums.WorkspaceRoleOwner {
				return true, nil
			}
		}

		if apiKey != nil && apiKey.WorkspaceID != nil && *apiKey.WorkspaceID != *workspaceID {
			return false, nil // API key scoped to a different workspace
		}
	}

	// 3. Check for granular database-level rules
	if apiKey != nil {
		record, err := s.repository.FindByAPIKeyAndDatabase(ctx, apiKey.ID, databaseID)
		if err != nil {
			return false, err
		}
		if record != nil {
			switch action {
			case ActionView:
				return record.CanView, nil
			case ActionBackup:
				return record.CanBackup, nil
			case ActionRestore:
				return record.CanRestore, nil
			case ActionManage:
				return record.CanManage, nil
			}
		}
	} else if user != nil {
		record, err := s.repository.FindByUserAndDatabase(ctx, user.ID, databaseID)
		if err != nil {
			return false, err
		}
		if record != nil {
			switch action {
			case ActionView:
				return record.CanView, nil
			case ActionBackup:
				return record.CanBackup, nil
			case ActionRestore:
				return record.CanRestore, nil
			case ActionManage:
				return record.CanManage, nil
			}
		}
	}

	// 4. Default fallback to Workspace Role if no granular rule exists
	if workspaceID != nil && user != nil {
		canManageDBs, err := s.workspaceService.CanUserManageDBs(ctx, *workspaceID, user)
		if err != nil {
			return false, err
		}

		switch action {
		case ActionView:
			return true, nil
		case ActionBackup:
			return canManageDBs, nil
		case ActionRestore:
			return canManageDBs, nil
		case ActionManage:
			return canManageDBs, nil
		}
	}

	return true, nil
}

func (s *DatabaseAccessService) SetAccess(
	ctx context.Context,
	actor *users_models.User,
	workspaceID uuid.UUID,
	databaseID uuid.UUID,
	req SetDatabaseAccessRequest,
) error {
	// Actor must be platform Super Admin or Workspace Admin/Owner
	if actor.Role != users_enums.UserRoleAdmin {
		canManage, err := s.workspaceService.CanUserManageMembership(ctx, workspaceID, actor)
		if err != nil {
			return err
		}
		if !canManage {
			return errors.New("insufficient permissions to manage database access")
		}
	}

	if req.UserID == nil && req.APIKeyID == nil {
		return errors.New("must specify either userId or apiKeyId")
	}

	entry := &DatabaseAccessControl{
		DatabaseID: databaseID,
		UserID:     req.UserID,
		APIKeyID:   req.APIKeyID,
		CanView:    req.CanView,
		CanBackup:  req.CanBackup,
		CanRestore: req.CanRestore,
		CanManage:  req.CanManage,
	}

	return s.repository.Upsert(ctx, entry)
}

func (s *DatabaseAccessService) ListDatabaseAccess(
	ctx context.Context,
	actor *users_models.User,
	workspaceID uuid.UUID,
	databaseID uuid.UUID,
) ([]*DatabaseAccessResponse, error) {
	if actor.Role != users_enums.UserRoleAdmin {
		canAccess, _, err := s.workspaceService.CanUserAccessWorkspace(ctx, workspaceID, actor)
		if err != nil {
			return nil, err
		}
		if !canAccess {
			return nil, errors.New("insufficient permissions to view access list")
		}
	}

	records, err := s.repository.FindByDatabaseID(ctx, databaseID)
	if err != nil {
		return nil, err
	}

	res := make([]*DatabaseAccessResponse, 0, len(records))
	for _, r := range records {
		resp := &DatabaseAccessResponse{
			ID:         r.ID,
			DatabaseID: r.DatabaseID,
			UserID:     r.UserID,
			APIKeyID:   r.APIKeyID,
			CanView:    r.CanView,
			CanBackup:  r.CanBackup,
			CanRestore: r.CanRestore,
			CanManage:  r.CanManage,
			CreatedAt:  r.CreatedAt,
			UpdatedAt:  r.UpdatedAt,
		}

		if r.UserID != nil {
			if u, err := s.userRepository.GetUserByID(ctx, *r.UserID); err == nil && u != nil {
				resp.UserEmail = &u.Email
				name := u.Name
				resp.UserName = &name
			}
		}

		if r.APIKeyID != nil {
			if k, err := s.apiKeyRepository.FindByID(ctx, *r.APIKeyID); err == nil && k != nil {
				resp.APIKeyName = &k.Name
				pub := fmt.Sprintf("%s...", k.KeyID[:min(len(k.KeyID), 12)])
				resp.APIKeyPublic = &pub
			}
		}

		res = append(res, resp)
	}

	return res, nil
}

func (s *DatabaseAccessService) DeleteAccess(
	ctx context.Context,
	actor *users_models.User,
	workspaceID uuid.UUID,
	accessID uuid.UUID,
) error {
	if actor.Role != users_enums.UserRoleAdmin {
		canManage, err := s.workspaceService.CanUserManageMembership(ctx, workspaceID, actor)
		if err != nil {
			return err
		}
		if !canManage {
			return errors.New("insufficient permissions to delete database access rule")
		}
	}

	return s.repository.Delete(ctx, accessID)
}

