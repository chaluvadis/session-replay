/**
 * Session lifecycle and metadata types for the Dumb Pipe session replay platform.
 */

/**
 * Lifecycle status of a recording session.
 */
export type SessionStatus = "recording" | "completed" | "failed";

/**
 * Full session record returned by the get session endpoint.
 */
export interface Session {
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
  status: SessionStatus;
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
 * Optional metadata describing a recorded session.
 */
export interface SessionMetadata {
  /** Total number of chunks recorded for the session, if known. */
  totalChunks?: number;
  /** Total number of rrweb events recorded, if known. */
  totalEvents?: number;
  /** Total duration of the session in milliseconds, if known. */
  durationMs?: number;
  /** Browser name/version detected during recording, if available. */
  browser?: string;
  /** Viewport dimensions observed during recording, if available. */
  viewport?: string;
}
