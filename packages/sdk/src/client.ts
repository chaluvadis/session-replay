import type {
  CreateSessionResponse,
  PresignedUrlResponse,
  ErrorResponse,
} from "@dumb-pipe/types";

class DumbPipeError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "DumbPipeError";
    this.code = code;
    this.status = status;
  }
}

async function parseError(response: Response): Promise<DumbPipeError> {
  let code = "unexpected_error";
  let message = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as ErrorResponse;
    code = body.error.code || code;
    message = body.error.message || message;
  } catch {
    // ignore parse errors
  }
  return new DumbPipeError(response.status, code, message);
}

async function requestJSON(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<any> {
  const response = await fetch(input, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  async createSession(opts?: {
    sessionId?: string;
    application?: string;
    environment?: string;
    url?: string;
    userId?: string;
    runId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CreateSessionResponse> {
    return requestJSON(this.url("/api/sessions"), {
      method: "POST",
      body: JSON.stringify({
        sessionId: opts?.sessionId ?? crypto.randomUUID(),
        application: opts?.application ?? "unknown",
        environment: opts?.environment ?? "development",
        url: opts?.url ?? typeof location !== "undefined" ? location.href : "",
        userId: opts?.userId ?? null,
        runId: opts?.runId ?? null,
        metadata: opts?.metadata ?? {},
      }),
    });
  }

  async presignedPutChunk(opts: {
    sessionId: string;
    chunkIndex: number;
    objectKey?: string;
    sizeBytes?: number;
  }): Promise<PresignedUrlResponse> {
    return requestJSON(this.url("/api/chunks"), {
      method: "POST",
      body: JSON.stringify({
        sessionId: opts.sessionId,
        chunkIndex: opts.chunkIndex,
        fileSize: opts.sizeBytes ?? 0,
      }),
    });
  }

  async completeSession(sessionId: string): Promise<any> {
    return requestJSON(this.url(`/api/sessions/${sessionId}/complete`), {
      method: "POST",
    });
  }

  async listSessions(): Promise<any> {
    return requestJSON(this.url("/api/sessions"), { method: "GET" });
  }

  async getSessionChunks(sessionId: string): Promise<any> {
    return requestJSON(this.url(`/api/sessions/${sessionId}/chunks`), {
      method: "GET",
    });
  }
}

export { DumbPipeError };
