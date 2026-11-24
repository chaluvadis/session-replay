/**
 * Typed API client for the Dumb Pipe replay UI.
 *
 * Provides fetch wrappers for session listing and chunk retrieval,
 * with all responses typed against the shared @dumb-pipe/types interfaces.
 */

import type {
  GetSessionChunksResponse,
  SessionSummary,
} from "@dumb-pipe/types";

const BASE_URL =
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ??
  "http://localhost:8080";

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
 * List all sessions.
 * GET /api/sessions
 */
export async function listSessions(): Promise<SessionSummary[]> {
  const data = await requestJSON<{ sessions: SessionSummary[] }>(
    "/api/sessions",
  );
  return data.sessions ?? [];
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
