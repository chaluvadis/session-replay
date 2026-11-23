package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"dumb-pipe/api/internal/models"
)

// CreateSessionRequest represents the request body for creating a session.
type CreateSessionRequest struct {
	SessionID   string         `json:"sessionId"`
	Application string         `json:"application"`
	Environment string         `json:"environment"`
	URL         string         `json:"url"`
	UserID      *string        `json:"userId,omitempty"`
	RunID       *string        `json:"runId,omitempty"`
	Metadata    map[string]any `json:"metadata,omitempty"`
}

// CreateSessionResponse represents the response body for creating a session.
type CreateSessionResponse struct {
	SessionID string    `json:"sessionId"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

// CompleteSessionRequest represents the optional body for completing a session.
type CompleteSessionRequest struct {
	TotalChunks  *int `json:"totalChunks,omitempty"`
	TotalEvents  *int `json:"totalEvents,omitempty"`
	DurationMs   *int `json:"durationMs,omitempty"`
}

// SessionSummary represents a session in list responses.
type SessionSummary struct {
	SessionID   string     `json:"sessionId"`
	Application string     `json:"application"`
	Environment string     `json:"environment"`
	URL         string     `json:"url"`
	UserID      string     `json:"userId"`
	Status      string     `json:"status"`
	StartedAt   time.Time  `json:"startedAt"`
	CompletedAt *time.Time `json:"completedAt,omitempty"`
	DurationMs  *int       `json:"durationMs,omitempty"`
	TotalChunks *int       `json:"totalChunks,omitempty"`
}

// Pagination represents pagination metadata.
type Pagination struct {
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
	Count  int `json:"count"`
}

// ListSessionsResponse represents the response body for listing sessions.
type ListSessionsResponse struct {
	Sessions   []SessionSummary `json:"sessions"`
	Pagination Pagination       `json:"pagination"`
}

// SessionsHandler handles session-related requests.
type SessionsHandler struct {
	db *pgxpool.Pool
}

// NewSessionsHandler creates a new SessionsHandler.
func NewSessionsHandler(db *pgxpool.Pool) *SessionsHandler {
	return &SessionsHandler{db: db}
}

// CreateSession handles POST /api/sessions.
func (h *SessionsHandler) CreateSession(w http.ResponseWriter, r *http.Request) {
	var req CreateSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "malformed JSON body")
		return
	}

	// Validate required fields
	if req.SessionID == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "sessionId is required")
		return
	}
	if req.Application == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "application is required")
		return
	}
	if req.Environment == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "environment is required")
		return
	}

	// Default metadata to empty object if nil
	metadata := req.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}

	var createdAt time.Time
	err := h.db.QueryRow(r.Context(), `
		INSERT INTO sessions (id, status, application, environment, url, user_id, run_id, started_at, metadata)
		VALUES ($1, 'recording', $2, $3, $4, $5, $6, NOW(), $7)
		RETURNING started_at
	`, req.SessionID, req.Application, req.Environment, req.URL, req.UserID, req.RunID, metadata).Scan(&createdAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			writeError(w, http.StatusConflict, "SESSION_EXISTS", "session already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "db_error", "failed to create session")
		return
	}

	writeJSON(w, http.StatusCreated, CreateSessionResponse{
		SessionID: req.SessionID,
		Status:    "recording",
		CreatedAt: createdAt,
	})
}

// GetSession handles GET /api/sessions/{id}.
func (h *SessionsHandler) GetSession(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	if sessionID == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "session ID is required")
		return
	}

	var s models.Session
	var userID *string
	var completedAt *time.Time
	var metadata map[string]any

	err := h.db.QueryRow(r.Context(), `
		SELECT id, application, environment, url, user_id, status, started_at, completed_at, metadata
		FROM sessions
		WHERE id = $1
	`, sessionID).Scan(
		&s.ID, &s.Application, &s.Environment, &s.URL, &userID, &s.Status,
		&s.StartedAt, &completedAt, &metadata,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "session_not_found", "session not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "db_error", "failed to get session")
		return
	}

	if userID != nil {
		s.UserID = userID
	}
	s.CompletedAt = completedAt
	s.Metadata = metadata

	writeJSON(w, http.StatusOK, s)
}

// CompleteSession handles POST /api/sessions/{id}/complete.
func (h *SessionsHandler) CompleteSession(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	if sessionID == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "session ID is required")
		return
	}

	var req CompleteSessionRequest
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req) // ignore decode errors for optional body
	}

	// Build the UPDATE query dynamically based on provided metadata fields
	query := "UPDATE sessions SET status = 'completed', completed_at = NOW()"
	args := []any{sessionID}
	argIdx := 2

	hasMetadata := req.TotalChunks != nil || req.TotalEvents != nil || req.DurationMs != nil
	if hasMetadata {
		meta := map[string]any{}
		if req.TotalChunks != nil {
			meta["totalChunks"] = *req.TotalChunks
		}
		if req.TotalEvents != nil {
			meta["totalEvents"] = *req.TotalEvents
		}
		if req.DurationMs != nil {
			meta["durationMs"] = *req.DurationMs
		}
		metaJSON, err := json.Marshal(meta)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "encode_error", "failed to encode metadata")
			return
		}
		query += fmt.Sprintf(", metadata = metadata || $%d", argIdx)
		args = append(args, string(metaJSON))
		argIdx++
	}

	query += fmt.Sprintf(" WHERE id = $%d AND status = 'recording'", argIdx)

	result, err := h.db.Exec(r.Context(), query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "failed to complete session")
		return
	}

	if result.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "session_not_found", "session not found or already completed")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "completed"})
}

// ListSessions handles GET /api/sessions.
func (h *SessionsHandler) ListSessions(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	application := r.URL.Query().Get("application")
	environment := r.URL.Query().Get("environment")
	status := r.URL.Query().Get("status")
	if status == "" {
		status = "completed"
	}

	limit := 50
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			if n > 100 {
				n = 100
			}
			limit = n
		}
	}

	offset := 0
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}

	// Build query with filters
	query := `
		SELECT id, application, environment, url, user_id, status, started_at, completed_at,
		       (metadata->>'totalChunks')::int AS total_chunks,
		       (metadata->>'durationMs')::int AS duration_ms
		FROM sessions
		WHERE status = $1
	`
	args := []any{status}
	argIdx := 2

	if application != "" {
		query += fmt.Sprintf(" AND application = $%d", argIdx)
		args = append(args, application)
		argIdx++
	}
	if environment != "" {
		query += fmt.Sprintf(" AND environment = $%d", argIdx)
		args = append(args, environment)
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY started_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.db.Query(r.Context(), query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "failed to list sessions")
		return
	}
	defer rows.Close()

	var sessions []SessionSummary
	for rows.Next() {
		var s SessionSummary
		var userID *string
		var completedAt *time.Time
		var durationMs *int
		var totalChunks *int

		err := rows.Scan(
			&s.SessionID,
			&s.Application,
			&s.Environment,
			&s.URL,
			&userID,
			&s.Status,
			&s.StartedAt,
			&completedAt,
			&totalChunks,
			&durationMs,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "failed to scan session")
			return
		}

		if userID != nil {
			s.UserID = *userID
		}
		s.CompletedAt = completedAt
		s.DurationMs = durationMs
		s.TotalChunks = totalChunks

		sessions = append(sessions, s)
	}

	if sessions == nil {
		sessions = []SessionSummary{}
	}

	// Get total count for pagination
	countQuery := `SELECT COUNT(*) FROM sessions WHERE status = $1`
	countArgs := []any{status}
	cArgIdx := 2
	if application != "" {
		countQuery += fmt.Sprintf(" AND application = $%d", cArgIdx)
		countArgs = append(countArgs, application)
		cArgIdx++
	}
	if environment != "" {
		countQuery += fmt.Sprintf(" AND environment = $%d", cArgIdx)
		countArgs = append(countArgs, environment)
	}

	var count int
	if err := h.db.QueryRow(r.Context(), countQuery, countArgs...).Scan(&count); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", "failed to count sessions")
		return
	}

	writeJSON(w, http.StatusOK, ListSessionsResponse{
		Sessions: sessions,
		Pagination: Pagination{
			Limit:  limit,
			Offset: offset,
			Count:  count,
		},
	})
}
