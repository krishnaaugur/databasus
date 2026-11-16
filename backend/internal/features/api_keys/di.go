package api_keys

import (
	"databasus-backend/internal/features/email"
	users_repositories "databasus-backend/internal/features/users/repositories"
	workspaces_repositories "databasus-backend/internal/features/workspaces/repositories"
	"databasus-backend/internal/util/encryption"
	"databasus-backend/internal/util/logger"
)

var (
	apiKeyRepository = &APIKeyRepository{}
	apiKeyService    = &APIKeyService{
		apiKeyRepository,
		&users_repositories.UserRepository{},
		&workspaces_repositories.MembershipRepository{},
		email.GetEmailSMTPSender(),
		logger.GetLogger(),
		encryption.GetFieldEncryptor(),
	}
	apiKeyController = &APIKeyController{apiKeyService}
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
