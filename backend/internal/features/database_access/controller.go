package database_access

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	users_models "databasus-backend/internal/features/users/models"
)

type DatabaseAccessController struct {
	service *DatabaseAccessService
}

func (c *DatabaseAccessController) RegisterRoutes(router *gin.RouterGroup) {
	router.GET("/databases/:id/permissions", c.ListPermissions)
	router.POST("/databases/:id/permissions", c.SetPermissions)
	router.DELETE("/databases/:id/permissions/:permId", c.DeletePermission)
}

func getUserFromContext(ctx *gin.Context) (*users_models.User, bool) {
	userInterface, exists := ctx.Get("user")
	if !exists {
		return nil, false
	}
	user, ok := userInterface.(*users_models.User)
	return user, ok
}

func (c *DatabaseAccessController) ListPermissions(ctx *gin.Context) {
	user, ok := getUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	databaseID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid database ID"})
		return
	}

	wsQuery := ctx.Query("workspace_id")
	workspaceID, err := uuid.Parse(wsQuery)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "valid workspace_id query parameter is required"})
		return
	}

	permissions, err := c.service.ListDatabaseAccess(ctx.Request.Context(), user, workspaceID, databaseID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"permissions": permissions})
}

func (c *DatabaseAccessController) SetPermissions(ctx *gin.Context) {
	user, ok := getUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	databaseID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid database ID"})
		return
	}

	var req struct {
		WorkspaceID string `json:"workspaceId" binding:"required"`
		SetDatabaseAccessRequest
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	workspaceID, err := uuid.Parse(req.WorkspaceID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid workspaceId"})
		return
	}

	if err := c.service.SetAccess(ctx.Request.Context(), user, workspaceID, databaseID, req.SetDatabaseAccessRequest); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Database permissions saved successfully"})
}

func (c *DatabaseAccessController) DeletePermission(ctx *gin.Context) {
	user, ok := getUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	permID, err := uuid.Parse(ctx.Param("permId"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid permission ID"})
		return
	}

	wsQuery := ctx.Query("workspace_id")
	workspaceID, err := uuid.Parse(wsQuery)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "valid workspace_id query parameter is required"})
		return
	}

	if err := c.service.DeleteAccess(ctx.Request.Context(), user, workspaceID, permID); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Database permission removed successfully"})
}

