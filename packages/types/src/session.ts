/**
 * Session lifecycle and metadata types for the Dumb Pipe session replay platform.
 */

/**
 * Lifecycle status of a recording session.
 */
export type SessionStatus = "recording" | "completed" | "failed";

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
