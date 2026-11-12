package users_middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"databasus-backend/internal/features/api_keys"
	users_enums "databasus-backend/internal/features/users/enums"
	users_models "databasus-backend/internal/features/users/models"
	users_services "databasus-backend/internal/features/users/services"
	"databasus-backend/internal/util/logger"
)

func AuthMiddleware(userService *users_services.UserService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		// 1. Check for dedicated X-API-Key and X-API-Secret headers
		apiKeyHeader := ctx.GetHeader("X-API-Key")
		apiSecretHeader := ctx.GetHeader("X-API-Secret")
		if apiKeyHeader != "" && apiSecretHeader != "" {
			apiKeyService := api_keys.GetAPIKeyService()
			apiKey, user, err := apiKeyService.ValidateAPIKey(ctx.Request.Context(), apiKeyHeader, apiSecretHeader)
			if err != nil {
				logger.GetLogger().WarnContext(ctx.Request.Context(),
					"rejected a request with invalid API key headers", "client_ip", ctx.ClientIP(), "error", err)
				ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid API key or secret"})
				ctx.Abort()
				return
			}

			ctx.Set("user", user)
			ctx.Set("apiKey", apiKey)
			ctx.Request = ctx.Request.WithContext(
				logger.ContextWithUserID(ctx.Request.Context(), user.ID.String()),
			)
			ctx.Next()
			return
		}

		// 2. Check Authorization header
		token := ctx.GetHeader("Authorization")
		if token == "" {
			logger.GetLogger().WarnContext(ctx.Request.Context(),
				"rejected a request with no authorization header", "client_ip", ctx.ClientIP())

			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization token or API key required"})
			ctx.Abort()
			return
		}

		// Remove "Bearer " prefix if present
		if len(token) > 7 && strings.EqualFold(token[:7], "Bearer ") {
			token = strings.TrimSpace(token[7:])
		}

		// Check if Bearer token is an API key (e.g., Bearer dbs_live_xxx:dbs_sec_yyy)
		if strings.HasPrefix(token, "dbs_live_") {
			parts := strings.SplitN(token, ":", 2)
			if len(parts) != 2 {
				ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid API key format. Expected <key_id>:<secret>"})
				ctx.Abort()
				return
			}

			apiKeyService := api_keys.GetAPIKeyService()
			apiKey, user, err := apiKeyService.ValidateAPIKey(ctx.Request.Context(), parts[0], parts[1])
			if err != nil {
				logger.GetLogger().WarnContext(ctx.Request.Context(),
					"rejected a request with invalid API key token", "client_ip", ctx.ClientIP(), "error", err)
				ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid API key or secret"})
				ctx.Abort()
				return
			}

			ctx.Set("user", user)
			ctx.Set("apiKey", apiKey)
			ctx.Request = ctx.Request.WithContext(
				logger.ContextWithUserID(ctx.Request.Context(), user.ID.String()),
			)
			ctx.Next()
			return
		}

		// 3. Fallback to existing JWT validation
		user, err := userService.GetUserFromToken(ctx.Request.Context(), token)
		if err != nil {
			logger.GetLogger().WarnContext(ctx.Request.Context(),
				"rejected a request with an invalid token", "client_ip", ctx.ClientIP(), "error", err)

			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			ctx.Abort()
			return
		}

		ctx.Set("user", user)

		// Puts the principal on the context the controllers already pass into services, so every
		// downstream record carries it without a scoped logger.
		ctx.Request = ctx.Request.WithContext(
			logger.ContextWithUserID(ctx.Request.Context(), user.ID.String()),
		)

		ctx.Next()
	}
}

func RequireRole(requiredRole users_enums.UserRole) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userInterface, exists := ctx.Get("user")
		if !exists {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			ctx.Abort()
			return
		}

		user, ok := userInterface.(*users_models.User)
		if !ok {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user context"})
			ctx.Abort()
			return
		}

		if user.Role != requiredRole {
			logger.GetLogger().WarnContext(ctx.Request.Context(),
				"rejected a request from a user without the required role",
				"user_id", user.ID, "required_role", requiredRole, "user_role", user.Role,
				"client_ip", ctx.ClientIP())

			ctx.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
			ctx.Abort()
			return
		}

		ctx.Next()
	}
}

// GetUserFromContext helper function to extract user from gin context
func GetUserFromContext(ctx *gin.Context) (*users_models.User, bool) {
	userInterface, exists := ctx.Get("user")
	if !exists {
		return nil, false
	}

	user, ok := userInterface.(*users_models.User)

	return user, ok
}

// GetAPIKeyFromContext helper function to extract APIKey from gin context
func GetAPIKeyFromContext(ctx *gin.Context) (*api_keys.APIKey, bool) {
	keyInterface, exists := ctx.Get("apiKey")
	if !exists {
		return nil, false
	}

	key, ok := keyInterface.(*api_keys.APIKey)
	return key, ok
}
