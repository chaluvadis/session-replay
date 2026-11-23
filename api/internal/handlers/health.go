package handlers

import (
	"net/http"
	"time"
)

// HealthHandler handles health check requests.
type HealthHandler struct{}

// NewHealthHandler creates a new HealthHandler.
func NewHealthHandler() *HealthHandler {
	return &HealthHandler{}
}

// ServeHTTP handles GET /api/health and returns a healthy status.
func (h *HealthHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	response := map[string]any{
		"status":    "healthy",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	if err := writeJSON(w, http.StatusOK, response); err != nil {
		http.Error(w, `{"error":{"code":"encode_error","message":"failed to encode response"}}`, http.StatusInternalServerError)
	}
}
