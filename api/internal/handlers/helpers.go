package handlers

import (
	"encoding/json"
	"net/http"

	"dumb-pipe/api/internal/models"
)

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
