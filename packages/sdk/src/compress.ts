const encoder = new TextEncoder();

export async function gzipUint8Array(data: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream("gzip");
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

export function eventsToNdjsonBytes(events: unknown[]): Uint8Array {
  const lines = events.map((e) => JSON.stringify(e));
  return encoder.encode(lines.join("\n") + (lines.length ? "\n" : ""));
}

export function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}
