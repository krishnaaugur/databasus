package users_repositories

import (
	"time"

	"github.com/google/uuid"

	users_models "databasus-backend/internal/features/users/models"
	"databasus-backend/internal/storage"
)

type InvitationRepository struct{}

func (r *InvitationRepository) CreateInvitation(invitation *users_models.UserInvitation) error {
	if invitation.ID == uuid.Nil {
		invitation.ID = uuid.New()
	}
	if invitation.CreatedAt.IsZero() {
		invitation.CreatedAt = time.Now().UTC()
	}

	return storage.GetDb().Create(invitation).Error
}

func (r *InvitationRepository) GetValidInvitationByToken(
	token string,
) (*users_models.UserInvitation, error) {
	var invitation users_models.UserInvitation
	err := storage.GetDb().
		Where("token = ? AND expires_at > ?", token, time.Now().UTC()).
		First(&invitation).Error
	if err != nil {
		return nil, err
	}

	return &invitation, nil
}

func (r *InvitationRepository) DeleteInvitation(id uuid.UUID) error {
	return storage.GetDb().
		Where("id = ?", id).
		Delete(&users_models.UserInvitation{}).Error
}

func (r *InvitationRepository) DeleteInvitationsByUserID(userID uuid.UUID) error {
	return storage.GetDb().
		Where("user_id = ?", userID).
		Delete(&users_models.UserInvitation{}).Error
}
