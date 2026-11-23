-- Migration 001: Initial schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(20) NOT NULL DEFAULT 'recording',
    application VARCHAR(100) NOT NULL,
    environment VARCHAR(50) NOT NULL,
    url TEXT,
    user_id VARCHAR(255),
    run_id UUID,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS session_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    object_key VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_application ON sessions(application);
CREATE INDEX IF NOT EXISTS idx_sessions_environment ON sessions(environment);
CREATE INDEX IF NOT EXISTS idx_sessions_run_id ON sessions(run_id);
CREATE INDEX IF NOT EXISTS idx_chunks_session ON session_chunks(session_id, chunk_index ASC);
