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

	"github.com/go-chi/chi/v5"
)

func TestCreateChunk_Valid(t *testing.T) {
	db := &mockDB{
		queryRowRow: newMockRow(true),
		execResult:  commandTag(1),
	}
	presigner := &mockPresigner{putURL: "https://presigned.example.com/upload"}
	h := NewChunksHandler(db, presigner)

	body := `{"sessionId":"sess-1","chunkIndex":0,"fileSize":1024}`
	req := httptest.NewRequest(http.MethodPost, "/api/chunks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.CreateChunk(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if resp["objectKey"] != "sess-1/000000.gz" {
		t.Errorf("expected objectKey 'sess-1/000000.gz', got %v", resp["objectKey"])
	}
}

func TestCreateChunk_SessionNotFound(t *testing.T) {
	db := &mockDB{
		queryRowRow: newMockRow(false),
	}
	presigner := &mockPresigner{}
	h := NewChunksHandler(db, presigner)

	body := `{"sessionId":"missing","chunkIndex":0,"fileSize":1024}`
	req := httptest.NewRequest(http.MethodPost, "/api/chunks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.CreateChunk(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rr.Code)
	}
	respBody, _ := io.ReadAll(rr.Body)
	if !strings.Contains(string(respBody), "session not found") {
		t.Errorf("expected 'session not found', got %s", string(respBody))
	}
}

func TestCreateChunk_NegativeChunkIndex(t *testing.T) {
	db := &mockDB{}
	presigner := &mockPresigner{}
	h := NewChunksHandler(db, presigner)

	body := `{"sessionId":"sess-1","chunkIndex":-1,"fileSize":1024}`
	req := httptest.NewRequest(http.MethodPost, "/api/chunks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.CreateChunk(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
	respBody, _ := io.ReadAll(rr.Body)
	if !strings.Contains(string(respBody), "chunkIndex must be non-negative") {
		t.Errorf("expected validation error, got %s", string(respBody))
	}
}

func TestCreateChunk_MissingFileSize(t *testing.T) {
	db := &mockDB{}
	presigner := &mockPresigner{}
	h := NewChunksHandler(db, presigner)

	body := `{"sessionId":"sess-1","chunkIndex":0}`
	req := httptest.NewRequest(http.MethodPost, "/api/chunks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.CreateChunk(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
	respBody, _ := io.ReadAll(rr.Body)
	if !strings.Contains(string(respBody), "fileSize must be positive") {
		t.Errorf("expected validation error, got %s", string(respBody))
	}
}

func TestCreateChunk_MalformedJSON(t *testing.T) {
	db := &mockDB{}
	presigner := &mockPresigner{}
	h := NewChunksHandler(db, presigner)

	req := httptest.NewRequest(http.MethodPost, "/api/chunks", strings.NewReader("{bad json"))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.CreateChunk(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestCreateChunk_DBError(t *testing.T) {
	db := &mockDB{
		queryRowErr: errors.New("connection refused"),
	}
	presigner := &mockPresigner{}
	h := NewChunksHandler(db, presigner)

	body := `{"sessionId":"sess-1","chunkIndex":0,"fileSize":1024}`
	req := httptest.NewRequest(http.MethodPost, "/api/chunks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.CreateChunk(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rr.Code)
	}
}

func TestGetChunk_Valid(t *testing.T) {
	db := &mockDB{
		queryRowRow: newMockRow(true),
		queryRows: newMockRows(
			[]any{0, "sess-1/000000.gz", int64(1024)},
			[]any{1, "sess-1/000001.gz", int64(2048)},
		),
	}
	presigner := &mockPresigner{}
	h := NewChunksHandler(db, presigner)

	req := httptest.NewRequest(http.MethodGet, "/api/sessions/sess-1/chunks", nil)
	rr := httptest.NewRecorder()

	r := chi.NewRouteContext()
	r.URLParams.Add("sessionID", "sess-1")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, r))

	h.GetChunk(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	chunks := resp["chunks"].([]any)
	if len(chunks) != 2 {
		t.Errorf("expected 2 chunks, got %d", len(chunks))
	}
}

func TestGetChunk_SessionNotFound(t *testing.T) {
	db := &mockDB{
		queryRowRow: newMockRow(false),
	}
	presigner := &mockPresigner{}
	h := NewChunksHandler(db, presigner)

	req := httptest.NewRequest(http.MethodGet, "/api/sessions/missing/chunks", nil)
	rr := httptest.NewRecorder()

	r := chi.NewRouteContext()
	r.URLParams.Add("sessionID", "missing")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, r))

	h.GetChunk(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rr.Code)
	}
}

func TestGetChunk_MissingSessionID(t *testing.T) {
	db := &mockDB{}
	presigner := &mockPresigner{}
	h := NewChunksHandler(db, presigner)

	req := httptest.NewRequest(http.MethodGet, "/api/sessions//chunks", nil)
	rr := httptest.NewRecorder()

	r := chi.NewRouteContext()
	r.URLParams.Add("sessionID", "")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, r))

	h.GetChunk(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}
