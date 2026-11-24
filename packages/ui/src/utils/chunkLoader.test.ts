import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadSessionEvents } from "./chunkLoader";
import type { SessionChunk } from "@dumb-pipe/types";

const originalFetch = globalThis.fetch;
const originalDecompressionStream = globalThis.DecompressionStream;

function mockFetch(responses: Record<string, Response>) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const response = responses[url];
    if (!response) {
      throw new Error(`No mock response for ${url}`);
    }
    return response;
  }) as unknown as typeof fetch;
}

function mockDecompressionStream(passThrough: boolean) {
  if (passThrough) {
    // Pass-through: readable emits whatever was written to writable
    globalThis.DecompressionStream = class {
      writable = new WritableStream<Uint8Array>({
        write(chunk) {
          (this as any)._buffer.push(chunk);
        },
      });
      readable = new ReadableStream<Uint8Array>({
        start(controller) {
          const self = this as any;
          self._buffer = [];
          const writer = self._stream.writable.getWriter();
          // This is a simplified pass-through; in tests we pre-populate
          controller.enqueue(new Uint8Array([1]));
        },
      }) as any;
    } as unknown as typeof DecompressionStream;
    return;
  }
  globalThis.DecompressionStream = originalDecompressionStream;
}

describe("loadSessionEvents", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    globalThis.DecompressionStream = originalDecompressionStream;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.DecompressionStream = originalDecompressionStream;
  });

  it("returns empty array for empty chunks", async () => {
    const events = await loadSessionEvents([]);
    expect(events).toEqual([]);
  });

  it("fetches all chunks in parallel, decompresses, parses, and sorts by timestamp", async () => {
    // Chunk 1: events at timestamps 100 and 300
    const chunk1Text = '{"type":"dom.load","timestamp":100}\n{"type":"dom.click","timestamp":300}\n';
    // Chunk 2: event at timestamp 200
    const chunk2Text = '{"type":"dom.scroll","timestamp":200}\n';

    const gzip1 = await gzipString(chunk1Text);
    const gzip2 = await gzipString(chunk2Text);

    const responses: Record<string, Response> = {
      "https://storage.example.com/chunk1": new Response(gzip1 as unknown as BodyInit, {
        status: 200,
        headers: { "Content-Type": "application/gzip" },
      }),
      "https://storage.example.com/chunk2": new Response(gzip2 as unknown as BodyInit, {
        status: 200,
        headers: { "Content-Type": "application/gzip" },
      }),
    };
    mockFetch(responses);

    const chunks: SessionChunk[] = [
      { chunkIndex: 0, objectKey: "sess/000000.gz", fileSize: gzip1.byteLength, presignedUrl: "https://storage.example.com/chunk1", expiresAt: new Date().toISOString() },
      { chunkIndex: 1, objectKey: "sess/000001.gz", fileSize: gzip2.byteLength, presignedUrl: "https://storage.example.com/chunk2", expiresAt: new Date().toISOString() },
    ];

    const events = await loadSessionEvents(chunks);

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ timestamp: 100 });
    expect(events[1]).toMatchObject({ timestamp: 200 });
    expect(events[2]).toMatchObject({ timestamp: 300 });

    // Verify fetch was called for both chunks (parallel)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("skips malformed NDJSON lines without crashing", async () => {
    const chunkText = '{"type":"valid","timestamp":100}\n{not valid json}\n{"type":"also-valid","timestamp":200}\n';
    const gzip = await gzipString(chunkText);

    const responses: Record<string, Response> = {
      "https://storage.example.com/chunk1": new Response(gzip as unknown as BodyInit, {
        status: 200,
        headers: { "Content-Type": "application/gzip" },
      }),
    };
    mockFetch(responses);

    const chunks: SessionChunk[] = [
      { chunkIndex: 0, objectKey: "sess/000000.gz", fileSize: gzip.byteLength, presignedUrl: "https://storage.example.com/chunk1", expiresAt: new Date().toISOString() },
    ];

    const events = await loadSessionEvents(chunks);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: "valid", timestamp: 100 });
    expect(events[1]).toMatchObject({ type: "also-valid", timestamp: 200 });
  });

  it("skips empty lines in NDJSON", async () => {
    const chunkText = '{"type":"event","timestamp":100}\n\n\n{"type":"event2","timestamp":200}\n';
    const gzip = await gzipString(chunkText);

    const responses: Record<string, Response> = {
      "https://storage.example.com/chunk1": new Response(gzip as unknown as BodyInit, {
        status: 200,
        headers: { "Content-Type": "application/gzip" },
      }),
    };
    mockFetch(responses);

    const chunks: SessionChunk[] = [
      { chunkIndex: 0, objectKey: "sess/000000.gz", fileSize: gzip.byteLength, presignedUrl: "https://storage.example.com/chunk1", expiresAt: new Date().toISOString() },
    ];

    const events = await loadSessionEvents(chunks);

    expect(events).toHaveLength(2);
  });

  it("throws when a chunk fetch fails", async () => {
    const responses: Record<string, Response> = {
      "https://storage.example.com/chunk1": new Response(null, { status: 500 }),
    };
    mockFetch(responses);

    const chunks: SessionChunk[] = [
      { chunkIndex: 0, objectKey: "sess/000000.gz", fileSize: 100, presignedUrl: "https://storage.example.com/chunk1", expiresAt: new Date().toISOString() },
    ];

    await expect(loadSessionEvents(chunks)).rejects.toThrow(/Failed to fetch chunk/);
  });
});

// Helper: compress a string to gzip using CompressionStream
async function gzipString(text: string): Promise<Uint8Array> {
  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(text));
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
