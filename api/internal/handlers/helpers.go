package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"dumb-pipe/api/internal/models"
)

// DB is the minimal database interface used by handlers.
// *pgxpool.Pool satisfies this interface.
type DB interface {
	QueryRow(ctx context.Context, query string, args ...any) pgx.Row
	Query(ctx context.Context, query string, args ...any) (pgx.Rows, error)
	Exec(ctx context.Context, query string, args ...any) (pgconn.CommandTag, error)
}

// writeJSON writes a JSON response with the given status code and payload.
func writeJSON(w http.ResponseWriter, status int, payload any) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(payload)
}

// writeError writes an ApiError response with the given status code.
func writeError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(models.NewApiError(code, message))
}

// writeNotImplemented writes a 501 Not Implemented error response.
func writeNotImplemented(w http.ResponseWriter, message string) {
	writeError(w, http.StatusNotImplemented, "not_implemented", message)
}
