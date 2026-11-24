import { describe, it, expect, beforeEach } from "vitest";
import { StreamingCompressor } from "./compressor";
import { eventsToNdjsonBytes } from "./compress";

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

describe("StreamingCompressor", () => {
  let compressor: StreamingCompressor;

  beforeEach(() => {
    compressor = new StreamingCompressor();
  });

  it("writeEvent produces valid NDJSON lines", async () => {
    const event1 = { type: "dom.load", timestamp: 100, data: { url: "https://example.com" } };
    const event2 = { type: "dom.click", timestamp: 200, data: { x: 10, y: 20 } };

    await compressor.writeEvent(event1);
    await compressor.writeEvent(event2);

    const compressed = await compressor.flush();
    const decompressed = await decompressGzip(new Uint8Array(compressed));
    const text = new TextDecoder().decode(decompressed);
    const lines = text.trim().split("\n");

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual(event1);
    expect(JSON.parse(lines[1])).toEqual(event2);
  });

  it("flush returns a valid gzip ArrayBuffer", async () => {
    await compressor.writeEvent({ type: "test", timestamp: 1 });
    const result = await compressor.flush();

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);

    // Verify it's valid gzip by decompressing
    const decompressed = await decompressGzip(new Uint8Array(result));
    const text = new TextDecoder().decode(decompressed);
    expect(text).toContain("test");
  });

  it("round-trip: compress -> decompress produces original events", async () => {
    const events = [
      { type: "dom.mousemove", timestamp: 100, x: 10, y: 20 },
      { type: "dom.mousemove", timestamp: 110, x: 15, y: 25 },
      { type: "dom.click", timestamp: 200, x: 15, y: 25 },
    ];

    for (const event of events) {
      await compressor.writeEvent(event);
    }

    const compressed = await compressor.flush();
    const decompressed = await decompressGzip(new Uint8Array(compressed));
    const text = new TextDecoder().decode(decompressed);
    const parsed = text.trim().split("\n").map((line) => JSON.parse(line));

    expect(parsed).toEqual(events);
  });

  it("reset creates a fresh stream", async () => {
    await compressor.writeEvent({ type: "first", timestamp: 1 });
    const first = await compressor.flush();

    compressor.reset();

    await compressor.writeEvent({ type: "second", timestamp: 2 });
    const second = await compressor.flush();

    const firstText = new TextDecoder().decode(await decompressGzip(new Uint8Array(first)));
    const secondText = new TextDecoder().decode(await decompressGzip(new Uint8Array(second)));

    expect(firstText).toContain("first");
    expect(firstText).not.toContain("second");
    expect(secondText).toContain("second");
    expect(secondText).not.toContain("first");
  });

  it("flush after reset produces only new events", async () => {
    await compressor.writeEvent({ type: "a", timestamp: 1 });
    await compressor.flush();
    compressor.reset();

    await compressor.writeEvent({ type: "b", timestamp: 2 });
    const result = await compressor.flush();

    const text = new TextDecoder().decode(await decompressGzip(new Uint8Array(result)));
    const parsed = text.trim().split("\n").map((line) => JSON.parse(line));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ type: "b", timestamp: 2 });
  });

  it("throws if flush is called twice without reset", async () => {
    await compressor.writeEvent({ type: "x", timestamp: 1 });
    await compressor.flush();

    await expect(compressor.flush()).rejects.toThrow(/already flushed/);
  });

  it("throws if writeEvent is called after flush without reset", async () => {
    await compressor.writeEvent({ type: "x", timestamp: 1 });
    await compressor.flush();

    await expect(compressor.writeEvent({ type: "y", timestamp: 2 })).rejects.toThrow(
      /cannot write after flush/,
    );
  });

  it("throws if reset is called before flush", async () => {
    await compressor.writeEvent({ type: "x", timestamp: 1 });
    expect(() => compressor.reset()).toThrow(/cannot reset before flushing/);
  });
});

describe("eventsToNdjsonBytes", () => {
  it("serializes events as NDJSON with trailing newline", () => {
    const events = [{ a: 1 }, { b: 2 }];
    const bytes = eventsToNdjsonBytes(events);
    const text = new TextDecoder().decode(bytes);

    expect(text).toBe('{"a":1}\n{"b":2}\n');
  });

  it("handles empty array", () => {
    const bytes = eventsToNdjsonBytes([]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toBe("");
  });
});
