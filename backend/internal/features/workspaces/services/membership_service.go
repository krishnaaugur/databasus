package workspaces_services

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/google/uuid"

	audit_logs "databasus-backend/internal/features/audit_logs"
	audit_logs_models "databasus-backend/internal/features/audit_logs/models"
	users_dto "databasus-backend/internal/features/users/dto"
	users_enums "databasus-backend/internal/features/users/enums"
	users_models "databasus-backend/internal/features/users/models"
	users_services "databasus-backend/internal/features/users/services"
	workspaces_dto "databasus-backend/internal/features/workspaces/dto"
	workspaces_errors "databasus-backend/internal/features/workspaces/errors"
	workspaces_interfaces "databasus-backend/internal/features/workspaces/interfaces"
	workspaces_models "databasus-backend/internal/features/workspaces/models"
	workspaces_repositories "databasus-backend/internal/features/workspaces/repositories"
)

type MembershipService struct {
	membershipRepository *workspaces_repositories.MembershipRepository
	workspaceRepository  *workspaces_repositories.WorkspaceRepository
	userService          *users_services.UserService
	auditLogService      *audit_logs.AuditLogService
	workspaceService     *WorkspaceService
	settingsService      *users_services.SettingsService
	emailSender          workspaces_interfaces.EmailSender
	logger               *slog.Logger
}

func (s *MembershipService) SetEmailSender(sender workspaces_interfaces.EmailSender) {
	s.emailSender = sender
}

func (s *MembershipService) GetMembers(
	ctx context.Context,
	workspaceID uuid.UUID,
	user *users_models.User,
) (*workspaces_dto.GetMembersResponseDTO, error) {
	canView, _, err := s.workspaceService.CanUserAccessWorkspace(ctx, workspaceID, user)
	if err != nil {
		return nil, err
	}
	if !canView {
		return nil, workspaces_errors.ErrInsufficientPermissionsToViewMembers
	}

	members, err := s.membershipRepository.GetWorkspaceMembers(workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get workspace members: %w", err)
	}

	membersList := make([]workspaces_dto.WorkspaceMemberResponseDTO, len(members))
	for i, member := range members {
		membersList[i] = *member
	}

	return &workspaces_dto.GetMembersResponseDTO{
		Members: membersList,
	}, nil
}

func (s *MembershipService) AddMember(
	ctx context.Context,
	workspaceID uuid.UUID,
	request *workspaces_dto.AddMemberRequestDTO,
	addedBy *users_models.User,
) (*workspaces_dto.AddMemberResponseDTO, error) {
	if err := s.validateCanManageMembership(ctx, workspaceID, addedBy, request.Role); err != nil {
		return nil, err
	}

	targetUser, err := s.userService.GetUserByEmail(ctx, request.Email)
	if err != nil {
		return nil, err
	}

	if targetUser == nil {
		// User doesn't exist, invite them
		settings, err := s.settingsService.GetSettings(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to get settings: %w", err)
		}

		if !addedBy.CanInviteUsers(settings) {
			return nil, workspaces_errors.ErrInsufficientPermissionsToInviteUsers
		}

		// Get workspace details for email
		workspace, err := s.workspaceRepository.GetWorkspaceByID(workspaceID)
		if err != nil {
			return nil, fmt.Errorf("failed to get workspace: %w", err)
		}

		inviteRequest := &users_dto.InviteUserRequestDTO{
			Email:                 request.Email,
			IntendedWorkspaceID:   &workspaceID,
			IntendedWorkspaceRole: &request.Role,
		}

		inviteResponse, err := s.userService.InviteUser(ctx, inviteRequest, addedBy)
		if err != nil {
			return nil, err
		}

		var invitationLink *string
		invitation, err := s.userService.CreateInvitation(ctx, inviteResponse.ID, &workspaceID)
		if err == nil {
			link := s.userService.BuildInvitationLink(invitation.Token)
			invitationLink = &link
			_ = s.userService.SendInvitationEmail(ctx, request.Email, workspace.Name, string(request.Role), link)
		}

		membership := &workspaces_models.WorkspaceMembership{
			UserID:      inviteResponse.ID,
			WorkspaceID: workspaceID,
			Role:        request.Role,
		}

		if err := s.membershipRepository.CreateMembership(membership); err != nil {
			return nil, fmt.Errorf("failed to add member: %w", err)
		}

		s.auditLogService.WriteAuditLog(ctx, audit_logs_models.AuditEntry{
			Message:     fmt.Sprintf("User invited to workspace: %s and added as %s", request.Email, request.Role),
			UserID:      &addedBy.ID,
			WorkspaceID: &workspaceID,
		})

		return &workspaces_dto.AddMemberResponseDTO{
			Status:         workspaces_dto.AddStatusInvited,
			InvitationLink: invitationLink,
		}, nil
	}

	existingMembership, _ := s.membershipRepository.GetMembershipByUserAndWorkspace(
		targetUser.ID,
		workspaceID,
	)
	if existingMembership != nil {
		return nil, workspaces_errors.ErrUserAlreadyMember
	}

	membership := &workspaces_models.WorkspaceMembership{
		UserID:      targetUser.ID,
		WorkspaceID: workspaceID,
		Role:        request.Role,
	}

	if err := s.membershipRepository.CreateMembership(membership); err != nil {
		return nil, fmt.Errorf("failed to add member: %w", err)
	}

	s.auditLogService.WriteAuditLog(ctx, audit_logs_models.AuditEntry{
		Message:     fmt.Sprintf("User added to workspace: %s as %s", targetUser.Email, request.Role),
		UserID:      &addedBy.ID,
		WorkspaceID: &workspaceID,
	})

	return &workspaces_dto.AddMemberResponseDTO{
		Status: workspaces_dto.AddStatusAdded,
	}, nil
}

func (s *MembershipService) ChangeMemberRole(
	ctx context.Context,
	workspaceID uuid.UUID,
	memberUserID uuid.UUID,
	request *workspaces_dto.ChangeMemberRoleRequestDTO,
	changedBy *users_models.User,
) error {
	if err := s.validateCanManageMembership(ctx, workspaceID, changedBy, request.Role); err != nil {
		return err
	}

	if memberUserID == changedBy.ID {
		return workspaces_errors.ErrCannotChangeOwnRole
	}

	existingMembership, err := s.membershipRepository.GetMembershipByUserAndWorkspace(
		memberUserID,
		workspaceID,
	)
	if err != nil {
		return workspaces_errors.ErrUserNotMemberOfWorkspace
	}

	if existingMembership.Role == users_enums.WorkspaceRoleOwner {
		return workspaces_errors.ErrCannotChangeOwnerRole
	}

	targetUser, err := s.userService.GetUserByID(ctx, memberUserID)
	if err != nil {
		return workspaces_errors.ErrUserNotFound
	}

	if err := s.membershipRepository.UpdateMemberRole(
		memberUserID,
		workspaceID,
		request.Role,
	); err != nil {
		return fmt.Errorf("failed to update member role: %w", err)
	}

	s.auditLogService.WriteAuditLog(ctx, audit_logs_models.AuditEntry{
		Message: fmt.Sprintf(
			"Member role changed: %s from %s to %s",
			targetUser.Email,
			existingMembership.Role,
			request.Role,
		),
		UserID:      &changedBy.ID,
		WorkspaceID: &workspaceID,
	})

	return nil
}

func (s *MembershipService) RemoveMember(
	ctx context.Context,
	workspaceID uuid.UUID,
	memberUserID uuid.UUID,
	removedBy *users_models.User,
) error {
	canManage, err := s.workspaceService.CanUserManageMembership(ctx, workspaceID, removedBy)
	if err != nil {
		return err
	}

	if !canManage {
		return workspaces_errors.ErrInsufficientPermissionsToRemoveMembers
	}

	existingMembership, err := s.membershipRepository.GetMembershipByUserAndWorkspace(
		memberUserID,
		workspaceID,
	)
	if err != nil {
		return workspaces_errors.ErrUserNotMemberOfWorkspace
	}

	if existingMembership.Role == users_enums.WorkspaceRoleOwner {
		return workspaces_errors.ErrCannotRemoveWorkspaceOwner
	}

	if existingMembership.Role == users_enums.WorkspaceRoleAdmin {
		canManageAdmins, err := s.workspaceService.CanUserManageAdmins(ctx, workspaceID, removedBy)
		if err != nil {
			return err
		}
		if !canManageAdmins {
			return workspaces_errors.ErrOnlyOwnerCanRemoveAdmins
		}
	}

	targetUser, err := s.userService.GetUserByID(ctx, memberUserID)
	if err != nil {
		return workspaces_errors.ErrUserNotFound
	}

	if err := s.membershipRepository.RemoveMember(memberUserID, workspaceID); err != nil {
		return fmt.Errorf("failed to remove member: %w", err)
	}

	s.auditLogService.WriteAuditLog(ctx, audit_logs_models.AuditEntry{
		Message:     fmt.Sprintf("Member removed from workspace: %s", targetUser.Email),
		UserID:      &removedBy.ID,
		WorkspaceID: &workspaceID,
	})

	return nil
}

func (s *MembershipService) TransferOwnership(
	ctx context.Context,
	workspaceID uuid.UUID,
	request *workspaces_dto.TransferOwnershipRequestDTO,
	user *users_models.User,
) error {
	currentRole, err := s.membershipRepository.GetUserWorkspaceRole(ctx, workspaceID, user.ID)
	if err != nil {
		return fmt.Errorf("failed to get current user role: %w", err)
	}

	if user.Role != users_enums.UserRoleAdmin &&
		(currentRole == nil || *currentRole != users_enums.WorkspaceRoleOwner) {
		return workspaces_errors.ErrOnlyOwnerOrAdminCanTransferOwnership
	}

	newOwner, err := s.userService.GetUserByEmail(ctx, request.NewOwnerEmail)
	if err != nil {
		return workspaces_errors.ErrNewOwnerNotFound
	}

	if newOwner == nil {
		return workspaces_errors.ErrNewOwnerNotFound
	}

	_, err = s.membershipRepository.GetMembershipByUserAndWorkspace(newOwner.ID, workspaceID)
	if err != nil {
		return workspaces_errors.ErrNewOwnerMustBeMember
	}

	currentOwner, err := s.membershipRepository.GetWorkspaceOwner(workspaceID)
	if err != nil {
		return fmt.Errorf("failed to find current workspace owner: %w", err)
	}

	if currentOwner == nil {
		return workspaces_errors.ErrNoCurrentWorkspaceOwner
	}

	if err := s.membershipRepository.UpdateMemberRole(
		newOwner.ID,
		workspaceID,
		users_enums.WorkspaceRoleOwner,
	); err != nil {
		return fmt.Errorf("failed to update new owner role: %w", err)
	}

	if err := s.membershipRepository.UpdateMemberRole(
		currentOwner.UserID,
		workspaceID,
		users_enums.WorkspaceRoleAdmin,
	); err != nil {
		return fmt.Errorf("failed to update previous owner role: %w", err)
	}

	s.auditLogService.WriteAuditLog(ctx, audit_logs_models.AuditEntry{
		Message:     fmt.Sprintf("Workspace ownership transferred to: %s", newOwner.Email),
		UserID:      &user.ID,
		WorkspaceID: &workspaceID,
	})

	return nil
}

func (s *MembershipService) validateCanManageMembership(
	ctx context.Context,
	workspaceID uuid.UUID,
	user *users_models.User,
	changesRoleTo users_enums.WorkspaceRole,
) error {
	if changesRoleTo == users_enums.WorkspaceRoleAdmin {
		canManageAdmins, err := s.workspaceService.CanUserManageAdmins(ctx, workspaceID, user)
		if err != nil {
			return err
		}
		if !canManageAdmins {
			return workspaces_errors.ErrOnlyOwnerCanAddManageAdmins
		}
		return nil
	}

	canManageMembership, err := s.workspaceService.CanUserManageMembership(ctx, workspaceID, user)
	if err != nil {
		return err
	}

	if !canManageMembership {
		return workspaces_errors.ErrInsufficientPermissionsToManageMembers
	}

	return nil
}
