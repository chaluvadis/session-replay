package handlers

import (
	"net/http"
)

// ChunksHandler handles chunk-related requests.
//
// All methods are stubs returning 501 Not Implemented.
type ChunksHandler struct{}

// NewChunksHandler creates a new ChunksHandler.
func NewChunksHandler() *ChunksHandler {
	return &ChunksHandler{}
}

// CreateChunk handles POST /api/chunks.
func (h *ChunksHandler) CreateChunk(w http.ResponseWriter, r *http.Request) {
	writeNotImplemented(w, "create chunk not implemented")
}

// GetChunk handles GET /api/sessions/{id}/chunks.
func (h *ChunksHandler) GetChunk(w http.ResponseWriter, r *http.Request) {
	writeNotImplemented(w, "get chunk not implemented")
}
