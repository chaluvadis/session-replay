import type { Chunk } from "@dumb-pipe/types";

const BASE_URL = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env
  ?.VITE_API_BASE_URL ?? "http://localhost:8080";

async function requestJSON(path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

export const api = {
  listSessions: () => requestJSON("/api/sessions"),
  getSessionChunks: (sessionId: string) =>
    requestJSON(`/api/sessions/${sessionId}/chunks`) as Promise<{
      chunks: Chunk[];
    }>,
};

export async function fetchDecompressedChunk(presignedUrl: string): Promise<unknown[]> {
  const response = await fetch(presignedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch chunk: ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const decompressed = await decompressGzip(bytes);
  const text = new TextDecoder().decode(decompressed);

  const events: unknown[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // skip malformed lines
    }
  }
  return events;
}

async function decompressGzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  await writer.write(data as unknown as BufferSource);
  writer.close();

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
