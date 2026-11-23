/**
 * API request and response types for the Dumb Pipe session replay platform.
 *
 * These interfaces define the contracts for session and chunk management
 * endpoints. All property names use camelCase per the API contract.
 */

/**
 * Request payload for creating a new recording session.
 */
export interface CreateSessionRequest {
  /** Unique identifier for the session. */
  sessionId: string;
  /** Application name generating the session. */
  application: string;
  /** Deployment environment (e.g. "production", "staging"). */
  environment: string;
  /** URL being recorded. */
  url: string;
  /** Optional user identifier associated with the session. */
  userId?: string;
  /** Optional run identifier for multi-agent support. */
  runId?: string;
  /** Optional free-form metadata attached to the session. */
  metadata?: Record<string, unknown>;
}

/**
 * Response payload returned after creating a session.
 */
export interface CreateSessionResponse {
  /** Unique identifier for the created session. */
  sessionId: string;
  /** Current lifecycle status of the session. */
  status: string;
  /** ISO 8601 timestamp when the session was created. */
  createdAt: string;
}

/**
 * Request payload for registering a new chunk upload.
 */
export interface CreateChunkRequest {
  /** Identifier of the session the chunk belongs to. */
  sessionId: string;
  /** Zero-based index of the chunk within the session. */
  chunkIndex: number;
  /** Size of the chunk payload in bytes. */
  fileSize: number;
}

/**
 * Response payload containing the presigned upload URL for a chunk.
 */
export interface CreateChunkResponse {
  /** Presigned PUT URL for uploading the chunk to object storage. */
  uploadUrl: string;
  /** Object key under which the chunk is stored. */
  objectKey: string;
  /** ISO 8601 timestamp when the presigned URL expires. */
  expiresAt: string;
}

/**
 * Summary of a session returned by the list sessions endpoint.
 */
export interface SessionSummary {
  /** Unique identifier for the session. */
  sessionId: string;
  /** Application name generating the session. */
  application: string;
  /** Deployment environment. */
  environment: string;
  /** URL being recorded. */
  url: string;
  /** Optional user identifier associated with the session. */
  userId: string;
  /** Current lifecycle status of the session. */
  status: string;
  /** ISO 8601 timestamp when the session started. */
  startedAt: string;
  /** ISO 8601 timestamp when the session completed, if applicable. */
  completedAt?: string;
  /** Total duration of the session in milliseconds, if known. */
  durationMs?: number;
  /** Total number of chunks uploaded for the session, if known. */
  totalChunks?: number;
}

/**
 * Representation of a single session chunk for playback.
 */
export interface SessionChunk {
  /** Zero-based index of the chunk within the session. */
  chunkIndex: number;
  /** Object key under which the chunk is stored. */
  objectKey: string;
  /** Size of the chunk payload in bytes. */
  fileSize: number;
  /** Presigned GET URL for downloading the chunk during playback. */
  presignedUrl: string;
  /** ISO 8601 timestamp when the presigned URL expires. */
  expiresAt: string;
}

/**
 * Response payload containing all chunks for a session.
 */
export interface GetSessionChunksResponse {
  /** Identifier of the session. */
  sessionId: string;
  /** List of chunks belonging to the session. */
  chunks: SessionChunk[];
  /** Total number of chunks for the session. */
  totalChunks: number;
}

/**
 * Standardized API error response body.
 */
export interface ApiError {
  /** Structured error information. */
  error: {
    /** Machine-readable error code. */
    code: string;
    /** Human-readable error message. */
    message: string;
    /** Optional additional error details. */
    details?: unknown;
  };
}
