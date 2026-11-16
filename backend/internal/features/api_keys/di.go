package api_keys

import (
	"databasus-backend/internal/features/email"
	users_repositories "databasus-backend/internal/features/users/repositories"
	workspaces_repositories "databasus-backend/internal/features/workspaces/repositories"
	"databasus-backend/internal/util/logger"
)

var (
	apiKeyRepository = &APIKeyRepository{}
	apiKeyService    = &APIKeyService{
		repository:           apiKeyRepository,
		userRepository:       &users_repositories.UserRepository{},
		membershipRepository: &workspaces_repositories.MembershipRepository{},
		emailSender:          email.GetEmailSMTPSender(),
		logger:               logger.GetLogger(),
	}
	apiKeyController = &APIKeyController{
		service: apiKeyService,
	}
)

func GetAPIKeyService() *APIKeyService {
	return apiKeyService
}

func GetAPIKeyRepository() *APIKeyRepository {
	return apiKeyRepository
}

func GetAPIKeyController() *APIKeyController {
	return apiKeyController
}
