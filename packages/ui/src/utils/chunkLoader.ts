/**
 * Chunk loader utility for Dumb Pipe replay UI.
 *
 * Fetches chunk data from presigned URLs in parallel, decompresses
 * gzip-compressed NDJSON using the native browser DecompressionStream API,
 * parses the events, flattens them into a single array, and sorts by
 * timestamp for correct rrweb-player playback.
 */

import type { SessionChunk } from "@dumb-pipe/types";

/**
 * Decompress a gzip-compressed Uint8Array using the native browser
 * DecompressionStream API.
 */
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

/**
 * Parse NDJSON text into an array of event objects.
 * Skips empty lines and malformed JSON.
 */
function parseNdjson(text: string): unknown[] {
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

/**
 * Load and decompress all chunk events in parallel, then flatten and
 * sort by timestamp for correct playback ordering.
 *
 * @param chunks - Array of session chunks with presigned URLs.
 * @returns A promise resolving to a sorted array of replay events.
 */
export async function loadSessionEvents(
  chunks: SessionChunk[],
): Promise<unknown[]> {
  if (chunks.length === 0) {
    return [];
  }

  // Fetch all chunks in parallel
  const responses = await Promise.all(
    chunks.map(async (chunk) => {
      const response = await fetch(chunk.presignedUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch chunk ${chunk.chunkIndex}: HTTP ${response.status}`,
        );
      }
      return response.arrayBuffer();
    }),
  );

  // Decompress and parse each chunk
  const eventArrays = await Promise.all(
    responses.map(async (buffer) => {
      const bytes = new Uint8Array(buffer);
      const decompressed = await decompressGzip(bytes);
      const text = new TextDecoder().decode(decompressed);
      return parseNdjson(text);
    }),
  );

  // Flatten and sort by timestamp
  const allEvents = eventArrays.flat();
  allEvents.sort((a, b) => {
    const ta = (a as { timestamp?: number }).timestamp ?? 0;
    const tb = (b as { timestamp?: number }).timestamp ?? 0;
    return ta - tb;
  });

  return allEvents;
}
