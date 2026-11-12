package api_keys

import (
	users_repositories "databasus-backend/internal/features/users/repositories"
	"databasus-backend/internal/util/logger"
)

var (
	apiKeyRepository = &APIKeyRepository{}
	apiKeyService    = &APIKeyService{
		repository:     apiKeyRepository,
		userRepository: &users_repositories.UserRepository{},
		logger:         logger.GetLogger(),
	}
	apiKeyController = &APIKeyController{
		service: apiKeyService,
	}
)

func GetAPIKeyService() *APIKeyService {
	return apiKeyService
}

func GetAPIKeyController() *APIKeyController {
	return apiKeyController
}

