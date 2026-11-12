package database_access

import (
	"databasus-backend/internal/features/api_keys"
	users_repositories "databasus-backend/internal/features/users/repositories"
	workspaces_services "databasus-backend/internal/features/workspaces/services"
	"databasus-backend/internal/util/logger"
)

var (
	databaseAccessRepository = &DatabaseAccessRepository{}
	databaseAccessService    = &DatabaseAccessService{
		repository:       databaseAccessRepository,
		userRepository:   &users_repositories.UserRepository{},
		apiKeyRepository: api_keys.GetAPIKeyRepository(),
		workspaceService: workspaces_services.GetWorkspaceService(),
		logger:           logger.GetLogger(),
	}
	databaseAccessController = &DatabaseAccessController{
		service: databaseAccessService,
	}
)

func GetDatabaseAccessService() *DatabaseAccessService {
	return databaseAccessService
}

func GetDatabaseAccessController() *DatabaseAccessController {
	return databaseAccessController
}

