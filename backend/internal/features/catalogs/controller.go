package catalogs

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	users_middleware "databasus-backend/internal/features/users/middleware"
)

type TenantCatalogController struct {
	service *TenantCatalogService
}

func (c *TenantCatalogController) RegisterRoutes(router *gin.RouterGroup) {
	router.POST("/catalogs", c.CreateCatalog)
	router.GET("/catalogs", c.ListCatalogs)
	router.GET("/catalogs/:id", c.GetCatalog)
	router.POST("/catalogs/:id/sync", c.SyncCatalog)
	router.DELETE("/catalogs/:id", c.DeleteCatalog)
}

func (c *TenantCatalogController) CreateCatalog(ctx *gin.Context) {
	user, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req CreateTenantCatalogRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	catalog, syncResult, err := c.service.CreateCatalog(ctx.Request.Context(), user, req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{
		"catalog":    catalog,
		"syncResult": syncResult,
	})
}

func (c *TenantCatalogController) ListCatalogs(ctx *gin.Context) {
	user, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	wsQuery := ctx.Query("workspace_id")
	if wsQuery == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id query parameter is required"})
		return
	}

	workspaceID, err := uuid.Parse(wsQuery)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid workspace_id"})
		return
	}

	catalogs, err := c.service.ListCatalogs(ctx.Request.Context(), user, workspaceID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"catalogs": catalogs})
}

func (c *TenantCatalogController) GetCatalog(ctx *gin.Context) {
	user, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid catalog ID"})
		return
	}

	catalog, err := c.service.GetCatalog(ctx.Request.Context(), user, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, catalog)
}

func (c *TenantCatalogController) SyncCatalog(ctx *gin.Context) {
	user, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid catalog ID"})
		return
	}

	result, err := c.service.SyncCatalog(ctx.Request.Context(), user, id)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

func (c *TenantCatalogController) DeleteCatalog(ctx *gin.Context) {
	user, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid catalog ID"})
		return
	}

	if err := c.service.DeleteCatalog(ctx.Request.Context(), user, id); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "catalog deleted successfully"})
}

