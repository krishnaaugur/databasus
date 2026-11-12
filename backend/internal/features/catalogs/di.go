package catalogs

import (
	"databasus-backend/internal/features/databases"
	workspaces_services "databasus-backend/internal/features/workspaces/services"
	"databasus-backend/internal/util/encryption"
	"databasus-backend/internal/util/logger"
)

var (
	tenantCatalogRepository = &TenantCatalogRepository{}
	tenantCatalogService    = &TenantCatalogService{
		repository:       tenantCatalogRepository,
		databaseService:  databases.GetDatabaseService(),
		workspaceService: workspaces_services.GetWorkspaceService(),
		fieldEncryptor:   encryption.GetFieldEncryptor(),
		logger:           logger.GetLogger(),
	}
	tenantCatalogController = &TenantCatalogController{
		service: tenantCatalogService,
	}
)

func GetTenantCatalogService() *TenantCatalogService {
	return tenantCatalogService
}

func GetTenantCatalogController() *TenantCatalogController {
	return tenantCatalogController
}

func GetTenantCatalogRepository() *TenantCatalogRepository {
	return tenantCatalogRepository
}

