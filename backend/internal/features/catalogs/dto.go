package catalogs

import (
	"time"

	"github.com/google/uuid"
)

type CreateTenantCatalogRequest struct {
	WorkspaceID uuid.UUID `json:"workspaceId" binding:"required"`
	Name        string    `json:"name" binding:"required"`

	// Central database connection
	DbHost     string `json:"dbHost" binding:"required"`
	DbPort     int    `json:"dbPort"`
	DbName     string `json:"dbName" binding:"required"`
	DbUsername string `json:"dbUsername" binding:"required"`
	DbPassword string `json:"dbPassword" binding:"required"`
	DbSslMode  string `json:"dbSslMode"`

	// Table and column discovery mapping
	TableName        string `json:"tableName" binding:"required"`
	IdentifierColumn string `json:"identifierColumn"`
	HostColumn       string `json:"hostColumn"`
	PortColumn       string `json:"portColumn"`
	DatabaseColumn   string `json:"databaseColumn"`
	UserColumn       string `json:"userColumn"`
	PasswordColumn   string `json:"passwordColumn"`
	FilterCondition  string `json:"filterCondition"`

	// Sync config
	IsAutoSyncEnabled   *bool `json:"isAutoSyncEnabled"`
	SyncIntervalMinutes int   `json:"syncIntervalMinutes"`
	RunInitialSync      *bool `json:"runInitialSync"`
}

type UpdateTenantCatalogRequest struct {
	Name                *string `json:"name"`
	DbHost              *string `json:"dbHost"`
	DbPort              *int    `json:"dbPort"`
	DbName              *string `json:"dbName"`
	DbUsername          *string `json:"dbUsername"`
	DbPassword          *string `json:"dbPassword"`
	DbSslMode           *string `json:"dbSslMode"`
	TableName           *string `json:"tableName"`
	IdentifierColumn    *string `json:"identifierColumn"`
	HostColumn          *string `json:"hostColumn"`
	PortColumn          *string `json:"portColumn"`
	DatabaseColumn      *string `json:"databaseColumn"`
	UserColumn          *string `json:"userColumn"`
	PasswordColumn      *string `json:"passwordColumn"`
	FilterCondition     *string `json:"filterCondition"`
	IsAutoSyncEnabled   *bool   `json:"isAutoSyncEnabled"`
	SyncIntervalMinutes *int    `json:"syncIntervalMinutes"`
}

type TenantCatalogResponse struct {
	ID                       uuid.UUID  `json:"id"`
	WorkspaceID              uuid.UUID  `json:"workspaceId"`
	Name                     string     `json:"name"`
	DbHost                   string     `json:"dbHost"`
	DbPort                   int        `json:"dbPort"`
	DbName                   string     `json:"dbName"`
	DbUsername               string     `json:"dbUsername"`
	DbSslMode                string     `json:"dbSslMode"`
	TableName                string     `json:"tableName"`
	IdentifierColumn         string     `json:"identifierColumn"`
	HostColumn               string     `json:"hostColumn"`
	PortColumn               string     `json:"portColumn"`
	DatabaseColumn           string     `json:"databaseColumn"`
	UserColumn               string     `json:"userColumn"`
	FilterCondition          string     `json:"filterCondition"`
	IsAutoSyncEnabled        bool       `json:"isAutoSyncEnabled"`
	SyncIntervalMinutes      int        `json:"syncIntervalMinutes"`
	LastSyncedAt             *time.Time `json:"lastSyncedAt,omitempty"`
	LastSyncStatus           string     `json:"lastSyncStatus"`
	LastSyncMessage          string     `json:"lastSyncMessage"`
	TotalDatabasesDiscovered int        `json:"totalDatabasesDiscovered"`
	CreatedAt                time.Time  `json:"createdAt"`
	UpdatedAt                time.Time  `json:"updatedAt"`
}

type CatalogSyncResult struct {
	CatalogID        uuid.UUID `json:"catalogId"`
	Status           string    `json:"status"`
	TotalFound       int       `json:"totalFound"`
	NewlyProvisioned []string  `json:"newlyProvisioned"`
	AlreadyExisting  []string  `json:"alreadyExisting"`
	FailedCount      int       `json:"failedCount"`
	Errors           []string  `json:"errors,omitempty"`
	Message          string    `json:"message"`
}

