package models

import "time"

// Session represents a recorded session in the system.
type Session struct {
	// ID is the unique identifier for the session.
	ID string `json:"sessionId"`

	// RunID is an optional identifier for multi-agent support.
	RunID *string `json:"runId,omitempty"`

	// Application is the name of the application generating the session.
	Application string `json:"application"`

	// Environment is the deployment environment (e.g. "production", "staging").
	Environment string `json:"environment"`

	// URL is the page URL being recorded.
	URL string `json:"url"`

	// UserID is an optional user identifier associated with the session.
	UserID *string `json:"userId,omitempty"`

	// Status is the current lifecycle status of the session.
	Status string `json:"status"`

	// StartedAt is the timestamp when the session was created.
	StartedAt time.Time `json:"startedAt"`

	// CompletedAt is the timestamp when the session completed, if applicable.
	CompletedAt *time.Time `json:"completedAt,omitempty"`

	// Metadata is optional free-form metadata stored as JSONB.
	Metadata map[string]any `json:"metadata,omitempty"`
}

// Chunk represents a single compressed chunk of session replay data.
type Chunk struct {
	// ID is the unique identifier for the chunk.
	ID string `json:"chunkId"`

	// SessionID is the identifier of the session the chunk belongs to.
	SessionID string `json:"sessionId"`

	// ChunkIndex is the zero-based index of the chunk within the session.
	ChunkIndex int `json:"chunkIndex"`

	// ObjectKey is the MinIO object key under which the chunk is stored.
	ObjectKey string `json:"objectKey"`

	// FileSize is the size of the chunk payload in bytes.
	FileSize int64 `json:"fileSize"`

	// CreatedAt is the timestamp when the chunk was recorded.
	CreatedAt time.Time `json:"createdAt"`
}
