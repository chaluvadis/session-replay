package handlers

import (
	"net/http"
)

// SessionsHandler handles session-related requests.
//
// All methods are stubs returning 501 Not Implemented.
type SessionsHandler struct{}

// NewSessionsHandler creates a new SessionsHandler.
func NewSessionsHandler() *SessionsHandler {
	return &SessionsHandler{}
}

// CreateSession handles POST /api/sessions.
func (h *SessionsHandler) CreateSession(w http.ResponseWriter, r *http.Request) {
	writeNotImplemented(w, "create session not implemented")
}

// GetSession handles GET /api/sessions/{id}.
func (h *SessionsHandler) GetSession(w http.ResponseWriter, r *http.Request) {
	writeNotImplemented(w, "get session not implemented")
}

// ListSessions handles GET /api/sessions.
func (h *SessionsHandler) ListSessions(w http.ResponseWriter, r *http.Request) {
	writeNotImplemented(w, "list sessions not implemented")
}

// CompleteSession handles POST /api/sessions/{id}/complete.
func (h *SessionsHandler) CompleteSession(w http.ResponseWriter, r *http.Request) {
	writeNotImplemented(w, "complete session not implemented")
}
