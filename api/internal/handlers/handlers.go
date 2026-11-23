package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ObjectStorage interface {
	PresignedPutObject(ctx context.Context, objectKey string, expiry time.Duration) (string, error)
	PresignedGetObject(ctx context.Context, objectKey string, expiry time.Duration) (string, error)
}

type Handler struct {
	db      *pgxpool.Pool
	storage ObjectStorage
}

func New(db *pgxpool.Pool, storage ObjectStorage) *Handler {
	return &Handler{db: db, storage: storage}
}

type errorResponse struct {
	Error errorDetail `json:"error"`
}

type errorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		http.Error(w, `{"error":{"code":"encode_error","message":"failed to encode response"}}`, http.StatusInternalServerError)
	}
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorResponse{Error: errorDetail{Code: code, Message: message}})
}

type sessionOut struct {
	ID          string     `json:"id"`
	RunID       string     `json:"run_id"`
	UserAgent   string     `json:"user_agent"`
	IP          string     `json:"ip"`
	CreatedAt   time.Time  `json:"created_at"`
	CompletedAt *time.Time `json:"completed_at"`
	Status      string     `json:"status"`
}

func (h *Handler) scanSession(dest *sessionOut, row pgx.Row) error {
	return row.Scan(&dest.ID, &dest.RunID, &dest.UserAgent, &dest.IP, &dest.CreatedAt, &dest.CompletedAt, &dest.Status)
}

// CreateSession registers a new session.
func (h *Handler) CreateSession(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserAgent string `json:"user_agent"`
		IP        string `json:"ip"`
		RunID     string `json:"run_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "malformed JSON body")
		return
	}

	sessionID := uuid.New()

	var runID interface{}
	if req.RunID != "" {
		parsed, err := uuid.Parse(req.RunID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid_run_id", "run_id is not a valid UUID")
			return
		}
		runID = parsed
	}

	var userAgent, ip interface{}
	if req.UserAgent != "" {
		userAgent = req.UserAgent
	}
	if req.IP != "" {
		ip = req.IP
	}

	var s sessionOut
	row := h.db.QueryRow(r.Context(), `
		INSERT INTO sessions (id, run_id, user_agent, ip, status)
		VALUES ($1, $2, $3, $4, 'active')
		RETURNING id, run_id, user_agent, ip, created_at, completed_at, status
	`, sessionID, runID, userAgent, ip)
	if err := h.scanSession(&s, row); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "failed to create session")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"session": s})
}

// CompleteSession marks a session complete.
func (h *Handler) CompleteSession(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_session_id", "session id is not a valid UUID")
		return
	}

	now := time.Now()
	var s sessionOut
	row := h.db.QueryRow(r.Context(), `
		UPDATE sessions
		SET status = 'completed', completed_at = $1
		WHERE id = $2 AND status = 'active'
		RETURNING id, run_id, user_agent, ip, created_at, completed_at, status
	`, now, sessionID)
	if err := h.scanSession(&s, row); err != nil {
		if err == pgx.ErrNoRows {
			writeError(w, http.StatusNotFound, "session_not_found", "session not found or already completed")
			return
		}
		writeError(w, http.StatusInternalServerError, "db_error", "failed to complete session")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"session": s})
}

// ListSessions returns all sessions ordered by created_at desc.
func (h *Handler) ListSessions(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(r.Context(), `
		SELECT id, run_id, user_agent, ip, created_at, completed_at, status
		FROM sessions
		ORDER BY created_at DESC
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "failed to list sessions")
		return
	}
	defer rows.Close()

	var sessions []sessionOut
	for rows.Next() {
		var s sessionOut
		if err := rows.Scan(&s.ID, &s.RunID, &s.UserAgent, &s.IP, &s.CreatedAt, &s.CompletedAt, &s.Status); err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "failed to scan session")
			return
		}
		sessions = append(sessions, s)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "failed to iterate sessions")
		return
	}
	if sessions == nil {
		sessions = []sessionOut{}
	}

	writeJSON(w, http.StatusOK, map[string]any{"sessions": sessions})
}

// GetSessionChunks returns presigned GET URLs for a session's chunks.
func (h *Handler) GetSessionChunks(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "id")
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_session_id", "session id is not a valid UUID")
		return
	}

	expiry := 15 * time.Minute
	rows, err := h.db.Query(r.Context(), `
		SELECT chunk_index, object_key, size_bytes
		FROM chunks
		WHERE session_id = $1
		ORDER BY chunk_index ASC
	`, sessionID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "failed to query chunks")
		return
	}
	defer rows.Close()

	type chunkOut struct {
		ChunkIndex int    `json:"chunk_index"`
		ObjectKey  string `json:"object_key"`
		SizeBytes  int64  `json:"size_bytes"`
		URL        string `json:"url"`
		ExpiresIn  int64  `json:"expires_in"`
	}

	var chunks []chunkOut
	for rows.Next() {
		var c chunkOut
		if err := rows.Scan(&c.ChunkIndex, &c.ObjectKey, &c.SizeBytes); err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "failed to scan chunk")
			return
		}
		url, err := h.storage.PresignedGetObject(r.Context(), c.ObjectKey, expiry)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "storage_error", "failed to generate presigned URL")
			return
		}
		c.URL = url
		c.ExpiresIn = int64(expiry.Seconds())
		chunks = append(chunks, c)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "failed to iterate chunks")
		return
	}
	if chunks == nil {
		chunks = []chunkOut{}
	}

	sort.Slice(chunks, func(i, j int) bool { return chunks[i].ChunkIndex < chunks[j].ChunkIndex })

	writeJSON(w, http.StatusOK, map[string]any{"chunks": chunks})
}

// UploadChunk returns a presigned PUT URL for uploading a chunk and records metadata.
func (h *Handler) UploadChunk(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SessionID  string `json:"session_id"`
		ChunkIndex int    `json:"chunk_index"`
		ObjectKey  string `json:"object_key"`
		SizeBytes  int64  `json:"size_bytes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "malformed JSON body")
		return
	}

	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_session_id", "session_id is not a valid UUID")
		return
	}

	var status string
	if err := h.db.QueryRow(r.Context(), `SELECT status FROM sessions WHERE id = $1`, sessionID).Scan(&status); err != nil {
		if err == pgx.ErrNoRows {
			writeError(w, http.StatusNotFound, "session_not_found", "session not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "db_error", "failed to verify session")
		return
	}
	if status != "active" {
		writeError(w, http.StatusBadRequest, "session_not_active", "session is not active")
		return
	}

	objectKey := req.ObjectKey
	if objectKey == "" {
		objectKey = fmt.Sprintf("%s/%06d.gz", sessionID.String(), req.ChunkIndex)
	}

	expiry := 10 * time.Minute
	url, err := h.storage.PresignedPutObject(r.Context(), objectKey, expiry)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "storage_error", "failed to generate presigned URL")
		return
	}

	_, err = h.db.Exec(r.Context(), `
		INSERT INTO chunks (session_id, chunk_index, object_key, size_bytes)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (session_id, chunk_index) DO UPDATE
		SET object_key = EXCLUDED.object_key, size_bytes = EXCLUDED.size_bytes
	`, sessionID, req.ChunkIndex, objectKey, req.SizeBytes)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "failed to record chunk")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"url":        url,
		"method":     "PUT",
		"object_key": objectKey,
		"expires_in": int64(expiry.Seconds()),
	})
}

func (h *Handler) Routes() *chi.Mux {
	r := chi.NewRouter()

	r.Route("/api", func(r chi.Router) {
		r.Post("/sessions", h.CreateSession)
		r.Post("/chunks", h.UploadChunk)
		r.Post("/sessions/{id}/complete", h.CompleteSession)
		r.Get("/sessions", h.ListSessions)
		r.Get("/sessions/{id}/chunks", h.GetSessionChunks)
	})

	return r
}

var _ = fmt.Sprintf
