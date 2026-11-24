/**
 * Shared TypeScript interfaces for Dumb Pipe.
 *
 * This barrel module re-exports all API and session types consumed by the
 * frontend SDK, replay UI, and Go backend.
 */

export type { SessionStatus } from "./session";
export type { SessionMetadata } from "./session";

export type {
  CreateSessionRequest,
  CreateSessionResponse,
  CreateChunkRequest,
  CreateChunkResponse,
  PresignedUrlResponse,
  SessionSummary,
  SessionChunk,
  GetSessionChunksResponse,
  ApiError,
  ErrorResponse,
} from "./api";
