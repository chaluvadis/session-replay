package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

// Presigner generates presigned URLs for object storage operations.
type Presigner interface {
	PresignedPutURL(ctx context.Context, objectKey string, expiry time.Duration) (string, error)
	PresignedGetURL(ctx context.Context, objectKey string, expiry time.Duration) (string, error)
}

// CreateChunkRequest represents the request body for creating a chunk upload URL.
type CreateChunkRequest struct {
	SessionID  string `json:"sessionId"`
	ChunkIndex int    `json:"chunkIndex"`
	FileSize   int64  `json:"fileSize"`
}

// CreateChunkResponse represents the response body for creating a chunk.
type CreateChunkResponse struct {
	UploadUrl string    `json:"uploadUrl"`
	ObjectKey string    `json:"objectKey"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// SessionChunk represents a single session chunk for playback.
type SessionChunk struct {
	ChunkIndex   int       `json:"chunkIndex"`
	ObjectKey    string    `json:"objectKey"`
	FileSize     int64     `json:"fileSize"`
	PresignedUrl string    `json:"presignedUrl"`
	ExpiresAt    time.Time `json:"expiresAt"`
}

// GetSessionChunksResponse represents the response body for listing session chunks.
type GetSessionChunksResponse struct {
	SessionID   string         `json:"sessionId"`
	Chunks      []SessionChunk `json:"chunks"`
	TotalChunks int            `json:"totalChunks"`
}

// ChunksHandler handles chunk-related requests.
type ChunksHandler struct {
	db        DB
	presigner Presigner
}

// NewChunksHandler creates a new ChunksHandler.
func NewChunksHandler(db DB, presigner Presigner) *ChunksHandler {
	return &ChunksHandler{db: db, presigner: presigner}
}

// CreateChunk handles POST /api/chunks.
func (h *ChunksHandler) CreateChunk(w http.ResponseWriter, r *http.Request) {
	var req CreateChunkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "malformed JSON body")
		return
	}

	// Validate required fields
	if req.SessionID == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "sessionId is required")
		return
	}
	if req.ChunkIndex < 0 {
		writeError(w, http.StatusBadRequest, "validation_error", "chunkIndex must be non-negative")
		return
	}
	if req.FileSize <= 0 {
		writeError(w, http.StatusBadRequest, "validation_error", "fileSize must be positive")
		return
	}

	if h.presigner == nil {
		writeError(w, http.StatusServiceUnavailable, "storage_unavailable", "object storage not available")
		return
	}

	// Validate session exists
	var exists bool
	err := h.db.QueryRow(r.Context(), `
		SELECT EXISTS(SELECT 1 FROM sessions WHERE id = $1)
	`, req.SessionID).Scan(&exists)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "failed to validate session")
		return
	}
	if !exists {
		writeError(w, http.StatusNotFound, "session_not_found", "session not found")
		return
	}

	// Generate object key
	objectKey := fmt.Sprintf("%s/%06d.gz", req.SessionID, req.ChunkIndex)

	// Generate presigned PUT URL (10 minute expiry)
	expiry := 10 * time.Minute
	expiresAt := time.Now().UTC().Add(expiry)
	uploadUrl, err := h.presigner.PresignedPutURL(r.Context(), objectKey, expiry)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "storage_error", "failed to generate presigned upload URL")
		return
	}

	// Insert or update chunk metadata
	_, err = h.db.Exec(r.Context(), `
		INSERT INTO session_chunks (session_id, chunk_index, object_key, file_size)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (session_id, chunk_index) DO UPDATE
		SET file_size = EXCLUDED.file_size
	`, req.SessionID, req.ChunkIndex, objectKey, req.FileSize)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "failed to record chunk")
		return
	}

	writeJSON(w, http.StatusOK, CreateChunkResponse{
		UploadUrl: uploadUrl,
		ObjectKey: objectKey,
		ExpiresAt: expiresAt,
	})
}

// GetChunk handles GET /api/sessions/{id}/chunks.
func (h *ChunksHandler) GetChunk(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "sessionID")
	if sessionID == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "session ID is required")
		return
	}

	// Validate session exists
	var exists bool
	err := h.db.QueryRow(r.Context(), `
		SELECT EXISTS(SELECT 1 FROM sessions WHERE id = $1)
	`, sessionID).Scan(&exists)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "failed to validate session")
		return
	}
	if !exists {
		writeError(w, http.StatusNotFound, "session_not_found", "session not found")
		return
	}

	// Query chunks ordered by chunk_index
	if h.presigner == nil {
		writeError(w, http.StatusServiceUnavailable, "storage_unavailable", "object storage not available")
		return
	}

	rows, err := h.db.Query(r.Context(), `
		SELECT chunk_index, object_key, file_size
		FROM session_chunks
		WHERE session_id = $1
		ORDER BY chunk_index ASC
	`, sessionID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "failed to query chunks")
		return
	}
	defer rows.Close()

	expiry := 10 * time.Minute
	expiresAt := time.Now().UTC().Add(expiry)

	var chunks []SessionChunk
	for rows.Next() {
		var chunkIndex int
		var objectKey string
		var fileSize int64

		if err := rows.Scan(&chunkIndex, &objectKey, &fileSize); err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "failed to scan chunk")
			return
		}

		// Generate presigned GET URL; skip chunk on failure
		presignedUrl, err := h.presigner.PresignedGetURL(r.Context(), objectKey, expiry)
		if err != nil {
			log.Printf("failed to generate presigned GET URL for chunk %s/%d: %v", sessionID, chunkIndex, err)
			continue
		}

		chunks = append(chunks, SessionChunk{
			ChunkIndex:   chunkIndex,
			ObjectKey:    objectKey,
			FileSize:     fileSize,
			PresignedUrl: presignedUrl,
			ExpiresAt:    expiresAt,
		})
	}

	if chunks == nil {
		chunks = []SessionChunk{}
	}

	writeJSON(w, http.StatusOK, GetSessionChunksResponse{
		SessionID:   sessionID,
		Chunks:      chunks,
		TotalChunks: len(chunks),
	})
}
