package catalogs

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	_ "github.com/lib/pq"

	"databasus-backend/internal/features/databases"
	postgresql_logical "databasus-backend/internal/features/databases/databases/postgresql/logical"
	postgresql_shared "databasus-backend/internal/features/databases/databases/postgresql/shared"
	users_models "databasus-backend/internal/features/users/models"
	workspaces_services "databasus-backend/internal/features/workspaces/services"
	"databasus-backend/internal/util/encryption"
	"databasus-backend/internal/util/tools"
)

type TenantCatalogService struct {
	repository       *TenantCatalogRepository
	databaseService  *databases.DatabaseService
	workspaceService *workspaces_services.WorkspaceService
	fieldEncryptor   encryption.FieldEncryptor
	logger           *slog.Logger
}

func (s *TenantCatalogService) CreateCatalog(
	ctx context.Context,
	user *users_models.User,
	req CreateTenantCatalogRequest,
) (*TenantCatalogResponse, *CatalogSyncResult, error) {
	canManage, err := s.workspaceService.CanUserManageDBs(ctx, req.WorkspaceID, user)
	if err != nil {
		return nil, nil, err
	}
	if !canManage {
		return nil, nil, errors.New("insufficient permissions to manage catalogs in this workspace")
	}

	port := req.DbPort
	if port <= 0 {
		port = 5432
	}

	sslMode := req.DbSslMode
	if sslMode == "" {
		sslMode = "require"
	}

	idCol := req.IdentifierColumn
	if idCol == "" {
		idCol = "subdomain"
	}
	hostCol := req.HostColumn
	if hostCol == "" {
		hostCol = "db_endpoint"
	}
	portCol := req.PortColumn
	if portCol == "" {
		portCol = "db_port"
	}
	dbCol := req.DatabaseColumn
	if dbCol == "" {
		dbCol = "db_name"
	}
	userCol := req.UserColumn
	if userCol == "" {
		userCol = "db_user"
	}
	passCol := req.PasswordColumn
	if passCol == "" {
		passCol = "db_password"
	}

	isAutoSync := true
	if req.IsAutoSyncEnabled != nil {
		isAutoSync = *req.IsAutoSyncEnabled
	}

	interval := req.SyncIntervalMinutes
	if interval <= 0 {
		interval = 15
	}

	catalog := &TenantCatalog{
		ID:                  uuid.New(),
		WorkspaceID:         req.WorkspaceID,
		Name:                req.Name,
		DbHost:              req.DbHost,
		DbPort:              port,
		DbName:              req.DbName,
		DbUsername:          req.DbUsername,
		DbPassword:          req.DbPassword,
		DbSslMode:           sslMode,
		TableName:           req.TableName,
		IdentifierColumn:    idCol,
		HostColumn:          hostCol,
		PortColumn:          portCol,
		DatabaseColumn:      dbCol,
		UserColumn:          userCol,
		PasswordColumn:      passCol,
		FilterCondition:     req.FilterCondition,
		IsAutoSyncEnabled:   isAutoSync,
		SyncIntervalMinutes: interval,
		LastSyncStatus:      "IDLE",
	}

	if err := catalog.EncryptSensitiveFields(s.fieldEncryptor); err != nil {
		return nil, nil, fmt.Errorf("failed to encrypt catalog credentials: %w", err)
	}

	if err := s.repository.Create(ctx, catalog); err != nil {
		return nil, nil, fmt.Errorf("failed to save catalog: %w", err)
	}

	var syncResult *CatalogSyncResult
	runSync := true
	if req.RunInitialSync != nil {
		runSync = *req.RunInitialSync
	}

	if runSync {
		res, syncErr := s.SyncCatalog(ctx, user, catalog.ID)
		if syncErr != nil {
			s.logger.WarnContext(ctx, "initial catalog sync warning", "catalog_id", catalog.ID, "error", syncErr)
		}
		syncResult = res
	}

	return s.toResponseDTO(catalog), syncResult, nil
}

func (s *TenantCatalogService) GetCatalog(
	ctx context.Context,
	user *users_models.User,
	id uuid.UUID,
) (*TenantCatalogResponse, error) {
	catalog, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if catalog == nil {
		return nil, errors.New("tenant catalog not found")
	}

	canManage, err := s.workspaceService.CanUserManageDBs(ctx, catalog.WorkspaceID, user)
	if err != nil {
		return nil, err
	}
	if !canManage {
		return nil, errors.New("insufficient permissions to view this catalog")
	}

	return s.toResponseDTO(catalog), nil
}

func (s *TenantCatalogService) ListCatalogs(
	ctx context.Context,
	user *users_models.User,
	workspaceID uuid.UUID,
) ([]*TenantCatalogResponse, error) {
	canManage, err := s.workspaceService.CanUserManageDBs(ctx, workspaceID, user)
	if err != nil {
		return nil, err
	}
	if !canManage {
		return nil, errors.New("insufficient permissions to view catalogs in this workspace")
	}

	catalogs, err := s.repository.ListByWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	var res []*TenantCatalogResponse
	for _, c := range catalogs {
		res = append(res, s.toResponseDTO(c))
	}
	return res, nil
}

func (s *TenantCatalogService) DeleteCatalog(
	ctx context.Context,
	user *users_models.User,
	id uuid.UUID,
) error {
	catalog, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if catalog == nil {
		return errors.New("tenant catalog not found")
	}

	canManage, err := s.workspaceService.CanUserManageDBs(ctx, catalog.WorkspaceID, user)
	if err != nil {
		return err
	}
	if !canManage {
		return errors.New("insufficient permissions to delete this catalog")
	}

	return s.repository.Delete(ctx, id)
}

func (s *TenantCatalogService) SyncCatalog(
	ctx context.Context,
	user *users_models.User,
	id uuid.UUID,
) (*CatalogSyncResult, error) {
	catalog, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if catalog == nil {
		return nil, errors.New("tenant catalog not found")
	}

	canManage, err := s.workspaceService.CanUserManageDBs(ctx, catalog.WorkspaceID, user)
	if err != nil {
		return nil, err
	}
	if !canManage {
		return nil, errors.New("insufficient permissions to sync this catalog")
	}

	// Decrypt password
	if err := catalog.DecryptSensitiveFields(s.fieldEncryptor); err != nil {
		return nil, fmt.Errorf("failed to decrypt catalog password: %w", err)
	}

	// Open connection to the Central DB
	connStr := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s connect_timeout=10",
		catalog.DbHost,
		catalog.DbPort,
		catalog.DbUsername,
		catalog.DbPassword,
		catalog.DbName,
		catalog.DbSslMode,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		s.recordSyncFailure(ctx, catalog, fmt.Sprintf("database driver connection error: %v", err))
		return nil, err
	}
	defer db.Close()

	if err := db.PingContext(ctx); err != nil {
		s.recordSyncFailure(ctx, catalog, fmt.Sprintf("failed to reach central database: %v", err))
		return nil, fmt.Errorf("central database ping failed: %w", err)
	}

	// Fetch existing databases in workspace to avoid re-provisioning
	existingDbs, err := s.databaseService.GetDatabasesByWorkspace(ctx, user, catalog.WorkspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to list existing workspace databases: %w", err)
	}

	existingNames := make(map[string]bool)
	for _, edb := range existingDbs {
		existingNames[strings.ToLower(edb.Name)] = true
	}

	// Construct query safely
	query := fmt.Sprintf(
		"SELECT %s, %s, %s, %s, %s, %s FROM %s",
		pq.QuoteIdentifier(catalog.IdentifierColumn),
		pq.QuoteIdentifier(catalog.HostColumn),
		pq.QuoteIdentifier(catalog.PortColumn),
		pq.QuoteIdentifier(catalog.DatabaseColumn),
		pq.QuoteIdentifier(catalog.UserColumn),
		pq.QuoteIdentifier(catalog.PasswordColumn),
		pq.QuoteIdentifier(catalog.TableName),
	)

	if catalog.FilterCondition != "" {
		query += " WHERE " + catalog.FilterCondition
	}

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		s.recordSyncFailure(ctx, catalog, fmt.Sprintf("failed to query tenant table '%s': %v", catalog.TableName, err))
		return nil, fmt.Errorf("querying tenant table failed: %w", err)
	}
	defer rows.Close()

	result := &CatalogSyncResult{
		CatalogID:        catalog.ID,
		Status:           "SUCCESS",
		NewlyProvisioned: []string{},
		AlreadyExisting:  []string{},
		Errors:           []string{},
	}

	for rows.Next() {
		result.TotalFound++

		var (
			identifier string
			host       string
			port       int
			dbName     string
			username   string
			password   string
		)

		if scanErr := rows.Scan(&identifier, &host, &port, &dbName, &username, &password); scanErr != nil {
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("row scan failed: %v", scanErr))
			continue
		}

		cleanIdentifier := strings.TrimSpace(identifier)
		expectedName := fmt.Sprintf("tenant-%s-db", cleanIdentifier)

		if existingNames[strings.ToLower(expectedName)] || existingNames[strings.ToLower(cleanIdentifier)] {
			result.AlreadyExisting = append(result.AlreadyExisting, cleanIdentifier)
			continue
		}

		if host == "" {
			continue
		}
		if port <= 0 {
			port = 5432
		}
		if dbName == "" {
			dbName = "postgres"
		}
		if username == "" {
			username = "postgres"
		}

		// Register database into Databasus
		newDb := &databases.Database{
			Name: expectedName,
			Type: databases.DatabaseTypePostgresLogical,
			PostgresqlLogical: &postgresql_logical.PostgresqlLogicalDatabase{
				Version:  tools.PostgresqlVersion17,
				Host:     host,
				Port:     port,
				Database: &dbName,
				Username: username,
				Password: password,
				SslMode:  postgresql_shared.PostgresSslMode(catalog.DbSslMode),
			},
		}

		createdDb, createErr := s.databaseService.CreateDatabase(ctx, user, catalog.WorkspaceID, newDb)
		if createErr != nil {
			result.FailedCount++
			errMsg := fmt.Sprintf("tenant '%s' failed to register in Databasus: %v", cleanIdentifier, createErr)
			result.Errors = append(result.Errors, errMsg)
			s.logger.WarnContext(ctx, errMsg)
			continue
		}

		existingNames[strings.ToLower(expectedName)] = true
		result.NewlyProvisioned = append(result.NewlyProvisioned, cleanIdentifier)
		s.logger.InfoContext(ctx, "auto-discovered tenant database registered", "tenant", cleanIdentifier, "database_id", createdDb.ID)
	}

	now := time.Now()
	catalog.LastSyncedAt = &now
	catalog.LastSyncStatus = "SUCCESS"
	catalog.TotalDatabasesDiscovered = result.TotalFound
	catalog.LastSyncMessage = fmt.Sprintf("Discovered %d tenants (%d new, %d existing)", result.TotalFound, len(result.NewlyProvisioned), len(result.AlreadyExisting))
	result.Message = catalog.LastSyncMessage

	if err := catalog.EncryptSensitiveFields(s.fieldEncryptor); err == nil {
		_ = s.repository.Update(ctx, catalog)
	}

	return result, nil
}

func (s *TenantCatalogService) recordSyncFailure(ctx context.Context, catalog *TenantCatalog, errMsg string) {
	now := time.Now()
	catalog.LastSyncedAt = &now
	catalog.LastSyncStatus = "FAILED"
	catalog.LastSyncMessage = errMsg
	if err := catalog.EncryptSensitiveFields(s.fieldEncryptor); err == nil {
		_ = s.repository.Update(ctx, catalog)
	}
}

func (s *TenantCatalogService) toResponseDTO(c *TenantCatalog) *TenantCatalogResponse {
	return &TenantCatalogResponse{
		ID:                       c.ID,
		WorkspaceID:              c.WorkspaceID,
		Name:                     c.Name,
		DbHost:                   c.DbHost,
		DbPort:                   c.DbPort,
		DbName:                   c.DbName,
		DbUsername:               c.DbUsername,
		DbSslMode:                c.DbSslMode,
		TableName:                c.TableName,
		IdentifierColumn:         c.IdentifierColumn,
		HostColumn:               c.HostColumn,
		PortColumn:               c.PortColumn,
		DatabaseColumn:           c.DatabaseColumn,
		UserColumn:               c.UserColumn,
		FilterCondition:          c.FilterCondition,
		IsAutoSyncEnabled:        c.IsAutoSyncEnabled,
		SyncIntervalMinutes:      c.SyncIntervalMinutes,
		LastSyncedAt:             c.LastSyncedAt,
		LastSyncStatus:           c.LastSyncStatus,
		LastSyncMessage:          c.LastSyncMessage,
		TotalDatabasesDiscovered: c.TotalDatabasesDiscovered,
		CreatedAt:                c.CreatedAt,
		UpdatedAt:                c.UpdatedAt,
	}
}

