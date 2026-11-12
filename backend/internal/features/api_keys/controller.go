package api_keys

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	users_models "databasus-backend/internal/features/users/models"
)

type APIKeyController struct {
	service *APIKeyService
}

func (c *APIKeyController) RegisterRoutes(router *gin.RouterGroup) {
	router.POST("/api-keys", c.CreateAPIKey)
	router.GET("/api-keys", c.ListAPIKeys)
	router.DELETE("/api-keys/:id", c.RevokeAPIKey)
}

func getUserFromContext(ctx *gin.Context) (*users_models.User, bool) {
	userInterface, exists := ctx.Get("user")
	if !exists {
		return nil, false
	}
	user, ok := userInterface.(*users_models.User)
	return user, ok
}

func (c *APIKeyController) CreateAPIKey(ctx *gin.Context) {
	user, ok := getUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req CreateAPIKeyRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	apiKey, err := c.service.CreateAPIKey(ctx.Request.Context(), user, req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, apiKey)
}

func (c *APIKeyController) ListAPIKeys(ctx *gin.Context) {
	user, ok := getUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var workspaceID *uuid.UUID
	wsQuery := ctx.Query("workspace_id")
	if wsQuery != "" {
		parsed, err := uuid.Parse(wsQuery)
		if err == nil {
			workspaceID = &parsed
		}
	}

	keys, err := c.service.ListAPIKeys(ctx.Request.Context(), user, workspaceID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"apiKeys": keys})
}

func (c *APIKeyController) RevokeAPIKey(ctx *gin.Context) {
	user, ok := getUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	keyUUID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid API key ID"})
		return
	}

	if err := c.service.RevokeAPIKey(ctx.Request.Context(), user, keyUUID); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "API key revoked successfully"})
}
