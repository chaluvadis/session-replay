export type SessionStatus = "active" | "completed" | "failed";

export interface Session {
  id: string;
  run_id: string | null;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  completed_at: string | null;
  status: SessionStatus;
}

export interface Chunk {
  id: string;
  session_id: string;
  chunk_index: number;
  object_key: string;
  size_bytes: number;
  created_at: string;
  url?: string;
  expires_in?: number;
}

export interface RrwebEvent {
  type: number;
  timestamp: number;
  data: unknown;
}

export interface PresignedUrlResponse {
  url: string;
  method: string;
  object_key: string;
  expires_in: number;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export interface CreateSessionRequest {
  user_agent?: string;
  ip?: string;
  run_id?: string;
}

export interface CreateSessionResponse {
  session: Session;
}

export interface CompleteSessionRequest {
  status?: SessionStatus;
}

export interface CompleteSessionResponse {
  session: Session;
}

export interface ListSessionsResponse {
  sessions: Session[];
}

export interface GetChunkUrlsResponse {
  chunks: Chunk[];
}

export interface UploadedChunk {
  session_id: string;
  chunk_index: number;
  object_key: string;
  size_bytes: number;
}

export interface UploadChunkRequest {
  session_id: string;
  chunk_index: number;
  events: RrwebEvent[];
}

export interface UploadChunkResponse {
  chunk: Chunk;
  upload_url: string;
}
