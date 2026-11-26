/**
 * Typed API client for the Dumb Pipe replay UI.
 *
 * Provides fetch wrappers for session listing and chunk retrieval,
 * with all responses typed against the shared @dumb-pipe/types interfaces.
 */

import type {
  GetSessionChunksResponse,
  Session,
  SessionSummary,
} from "@dumb-pipe/types";

const BASE_URL =
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ??
  "http://localhost:8080";

export interface ListSessionsParams {
  application?: string;
  environment?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ListSessionsResponse {
  sessions: SessionSummary[];
  pagination: {
    limit: number;
    offset: number;
    count: number;
  };
}

/**
 * Internal helper: perform a JSON fetch and parse the response.
 * Throws on non-ok responses.
 */
async function requestJSON<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

/**
 * List all sessions with optional filters and pagination.
 * GET /api/sessions
 */
export async function listSessions(
  params: ListSessionsParams = {},
): Promise<ListSessionsResponse> {
  const search = new URLSearchParams();
  if (params.application) search.set("application", params.application);
  if (params.environment) search.set("environment", params.environment);
  if (params.status) search.set("status", params.status);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));

  const path = `/api/sessions${search.toString() ? `?${search.toString()}` : ""}`;
  return requestJSON<ListSessionsResponse>(path);
}

/**
 * Get chunk presigned URLs for a session.
 * GET /api/sessions/:id/chunks
 */
export async function getSessionChunks(
  sessionId: string,
): Promise<GetSessionChunksResponse> {
  return requestJSON<GetSessionChunksResponse>(
    `/api/sessions/${sessionId}/chunks`,
  );
}

/**
 * Get session metadata by ID.
 * GET /api/sessions/:id
 */
export async function getSession(sessionId: string): Promise<Session> {
  return requestJSON<Session>(`/api/sessions/${sessionId}`);
}
