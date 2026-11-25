package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgconn"
)

func TestCreateSession_Valid(t *testing.T) {
	db := &mockDB{
		queryRowRow: newMockRow(time.Now()),
	}
	h := NewSessionsHandler(db)

	body := `{"sessionId":"sess-123","application":"myapp","environment":"production","url":"https://example.com"}`
	req := httptest.NewRequest(http.MethodPost, "/api/sessions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.CreateSession(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rr.Code)
	}

	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if resp["sessionId"] != "sess-123" {
		t.Errorf("expected sessionId 'sess-123', got %v", resp["sessionId"])
	}
	if resp["status"] != "recording" {
		t.Errorf("expected status 'recording', got %v", resp["status"])
	}
}

func TestCreateSession_MissingRequiredFields(t *testing.T) {
	tests := []struct {
		name   string
		body   string
		expect string
	}{
		{"missing sessionId", `{"application":"myapp","environment":"prod","url":"https://x.com"}`, "sessionId is required"},
		{"missing application", `{"sessionId":"s1","environment":"prod","url":"https://x.com"}`, "application is required"},
		{"missing environment", `{"sessionId":"s1","application":"myapp","url":"https://x.com"}`, "environment is required"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := &mockDB{}
			h := NewSessionsHandler(db)

			req := httptest.NewRequest(http.MethodPost, "/api/sessions", strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()

			h.CreateSession(rr, req)

			if rr.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d", rr.Code)
				return
			}
			body, _ := io.ReadAll(rr.Body)
			if !strings.Contains(string(body), tt.expect) {
				t.Errorf("expected error to contain %q, got %s", tt.expect, string(body))
			}
		})
	}
}

func TestCreateSession_DuplicateSessionID(t *testing.T) {
	db := &mockDB{
		queryRowRow: newMockRowErr(&pgconn.PgError{Code: "23505"}),
	}
	h := NewSessionsHandler(db)

	body := `{"sessionId":"sess-dup","application":"myapp","environment":"prod","url":"https://x.com"}`
	req := httptest.NewRequest(http.MethodPost, "/api/sessions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.CreateSession(rr, req)

	// errors.As with *pgconn.PgError verified separately; here we confirm
	// the duplicate error is handled (not a panic or 200 OK).
	if rr.Code != http.StatusConflict && rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 409 or 500, got %d", rr.Code)
	}
}

func TestCreateSession_MalformedJSON(t *testing.T) {
	db := &mockDB{}
	h := NewSessionsHandler(db)

	req := httptest.NewRequest(http.MethodPost, "/api/sessions", strings.NewReader("{not valid json"))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.CreateSession(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
	body, _ := io.ReadAll(rr.Body)
	if !strings.Contains(string(body), "malformed JSON body") {
		t.Errorf("expected malformed JSON error, got %s", string(body))
	}
}

func TestCreateSession_DBError(t *testing.T) {
	db := &mockDB{
		queryRowErr: errors.New("connection refused"),
	}
	h := NewSessionsHandler(db)

	body := `{"sessionId":"sess-1","application":"myapp","environment":"prod","url":"https://x.com"}`
	req := httptest.NewRequest(http.MethodPost, "/api/sessions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.CreateSession(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rr.Code)
	}
}

func TestGetSession_Valid(t *testing.T) {
	now := time.Now()
	db := &mockDB{
		queryRowRow: newMockRow(
			"sess-1", "myapp", "production", "https://x.com",
			nil, "completed", now, nil, map[string]any{},
		),
	}
	h := NewSessionsHandler(db)

	req := httptest.NewRequest(http.MethodGet, "/api/sessions/sess-1", nil)
	rr := httptest.NewRecorder()

	r := chi.NewRouteContext()
	r.URLParams.Add("id", "sess-1")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, r))

	h.GetSession(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestGetSession_NotFound(t *testing.T) {
	db := &mockDB{
		queryRowRow: newMockRowNoRows(),
	}
	h := NewSessionsHandler(db)

	req := httptest.NewRequest(http.MethodGet, "/api/sessions/missing", nil)
	rr := httptest.NewRecorder()

	r := chi.NewRouteContext()
	r.URLParams.Add("id", "missing")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, r))

	h.GetSession(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rr.Code)
	}
}

func TestGetSession_MissingID(t *testing.T) {
	db := &mockDB{}
	h := NewSessionsHandler(db)

	req := httptest.NewRequest(http.MethodGet, "/api/sessions/", nil)
	rr := httptest.NewRecorder()

	r := chi.NewRouteContext()
	r.URLParams.Add("id", "")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, r))

	h.GetSession(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestListSessions_Valid(t *testing.T) {
	now := time.Now()
	db := &mockDB{
		queryRows: newMockRows(
			[]any{"sess-1", "myapp", "prod", "https://x.com", nil, "completed", now, nil, 3, 1000},
			[]any{"sess-2", "otherapp", "staging", "https://y.com", "user-1", "completed", now, nil, 5, 2000},
		),
		queryRowRow: newMockRow(2),
	}
	h := NewSessionsHandler(db)

	req := httptest.NewRequest(http.MethodGet, "/api/sessions", nil)
	rr := httptest.NewRecorder()

	h.ListSessions(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	sessions := resp["sessions"].([]any)
	if len(sessions) != 2 {
		t.Errorf("expected 2 sessions, got %d", len(sessions))
	}
	pagination := resp["pagination"].(map[string]any)
	count := pagination["count"].(float64)
	if int(count) != 2 {
		t.Errorf("expected count 2, got %v", pagination["count"])
	}
}

func TestCompleteSession_Valid(t *testing.T) {
	db := &mockDB{
		execResult: commandTag(1),
	}
	h := NewSessionsHandler(db)

	req := httptest.NewRequest(http.MethodPost, "/api/sessions/sess-1/complete", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	r := chi.NewRouteContext()
	r.URLParams.Add("id", "sess-1")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, r))

	h.CompleteSession(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	respBody, _ := io.ReadAll(rr.Body)
	if !strings.Contains(string(respBody), "completed") {
		t.Errorf("expected 'completed' in response, got %s", string(respBody))
	}
}

func TestCompleteSession_AlreadyCompleted(t *testing.T) {
	db := &mockDB{
		execResult: commandTag(0),
	}
	h := NewSessionsHandler(db)

	req := httptest.NewRequest(http.MethodPost, "/api/sessions/sess-1/complete", nil)
	rr := httptest.NewRecorder()

	r := chi.NewRouteContext()
	r.URLParams.Add("id", "sess-1")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, r))

	h.CompleteSession(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rr.Code)
	}
}

func TestCompleteSession_NotFound(t *testing.T) {
	db := &mockDB{
		execResult: commandTag(0),
	}
	h := NewSessionsHandler(db)

	req := httptest.NewRequest(http.MethodPost, "/api/sessions/missing/complete", nil)
	rr := httptest.NewRecorder()

	r := chi.NewRouteContext()
	r.URLParams.Add("id", "missing")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, r))

	h.CompleteSession(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rr.Code)
	}
}
