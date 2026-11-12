package catalogs

import (
	"time"

	"github.com/google/uuid"

	"databasus-backend/internal/util/encryption"
)

type TenantCatalog struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	WorkspaceID uuid.UUID `json:"workspaceId" gorm:"type:uuid;not null;index"`
	Name        string    `json:"name" gorm:"type:varchar(255);not null"`

	// Central database connection
	DbHost     string `json:"dbHost" gorm:"type:text;not null"`
	DbPort     int    `json:"dbPort" gorm:"type:int;not null;default:5432"`
	DbName     string `json:"dbName" gorm:"type:text;not null"`
	DbUsername string `json:"dbUsername" gorm:"type:text;not null"`
	DbPassword string `json:"-" gorm:"type:text;not null"`
	DbSslMode  string `json:"dbSslMode" gorm:"type:varchar(50);not null;default:'require'"`

	// Table and column discovery mapping
	TableName        string `json:"tableName" gorm:"type:varchar(255);not null"`
	IdentifierColumn string `json:"identifierColumn" gorm:"type:varchar(100);not null;default:'subdomain'"`
	HostColumn       string `json:"hostColumn" gorm:"type:varchar(100);not null;default:'db_endpoint'"`
	PortColumn       string `json:"portColumn" gorm:"type:varchar(100);not null;default:'db_port'"`
	DatabaseColumn   string `json:"databaseColumn" gorm:"type:varchar(100);not null;default:'db_name'"`
	UserColumn       string `json:"userColumn" gorm:"type:varchar(100);not null;default:'db_user'"`
	PasswordColumn   string `json:"passwordColumn" gorm:"type:varchar(100);not null;default:'db_password'"`
	FilterCondition  string `json:"filterCondition" gorm:"type:text;default:''"`

	// Sync configuration and status
	IsAutoSyncEnabled        bool       `json:"isAutoSyncEnabled" gorm:"default:true"`
	SyncIntervalMinutes      int        `json:"syncIntervalMinutes" gorm:"default:15"`
	LastSyncedAt             *time.Time `json:"lastSyncedAt,omitempty"`
	LastSyncStatus           string     `json:"lastSyncStatus" gorm:"type:varchar(50);default:'IDLE'"`
	LastSyncMessage          string     `json:"lastSyncMessage" gorm:"type:text;default:''"`
	TotalDatabasesDiscovered int        `json:"totalDatabasesDiscovered" gorm:"default:0"`

	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`
}

func (TenantCatalog) TableName() string {
	return "tenant_catalogs"
}

func (c *TenantCatalog) EncryptSensitiveFields(encryptor encryption.FieldEncryptor) error {
	if c.DbPassword == "" {
		return nil
	}
	encrypted, err := encryptor.Encrypt(c.DbPassword)
	if err != nil {
		return err
	}
	c.DbPassword = encrypted
	return nil
}

func (c *TenantCatalog) DecryptSensitiveFields(encryptor encryption.FieldEncryptor) error {
	if c.DbPassword == "" {
		return nil
	}
	decrypted, err := encryptor.Decrypt(c.DbPassword)
	if err != nil {
		return err
	}
	c.DbPassword = decrypted
	return nil
}

