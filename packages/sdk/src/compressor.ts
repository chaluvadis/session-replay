const encoder = new TextEncoder();

/**
 * Performance timing helper. Measures the duration of a function call and logs it.
 */
function measureTime<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  return fn().finally(() => {
    const duration = performance.now() - start;
    // eslint-disable-next-line no-console
    console.log(`[StreamingCompressor] ${label} took ${duration.toFixed(2)}ms`);
  });
}

/**
 * StreamingCompressor provides incremental gzip compression using the native
 * browser CompressionStream API. Events are written as NDJSON lines and
 * compressed on-the-fly. Call flush() to finalize a chunk and obtain the
 * compressed ArrayBuffer, then reset() to start a new chunk.
 *
 * Only native browser APIs are used. No pako or external compression libraries.
 */
export class StreamingCompressor {
  private stream: CompressionStream;
  private writer: WritableStreamDefaultWriter<BufferSource>;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private closed = false;

  /**
   * Creates a new StreamingCompressor.
   *
   * @throws {Error} if CompressionStream is not available in the current environment.
   */
  constructor() {
    if (typeof CompressionStream === "undefined") {
      throw new Error(
        "StreamingCompressor: CompressionStream is not available in this environment. " +
          "Please use a modern browser that supports the CompressionStream API.",
      );
    }

    this.stream = new CompressionStream("gzip");
    this.writer = this.stream.writable.getWriter();
    this.reader = this.stream.readable.getReader();
  }

  /**
   * Writes a single event as an NDJSON line to the compression stream.
   *
   * @param event - The event object to serialize and compress.
   * @throws {Error} if the compressor has been flushed/closed.
   */
  async writeEvent(event: object): Promise<void> {
    if (this.closed) {
      throw new Error(
        "StreamingCompressor: cannot write after flush. Call reset() first.",
      );
    }

    await measureTime("writeEvent", async () => {
      const line = JSON.stringify(event) + "\n";
      const bytes = encoder.encode(line);
      await this.writer.write(bytes as BufferSource);
    });
  }

  /**
   * Finalizes the current compression chunk and returns the compressed data.
   *
   * Closes the writer, drains all compressed output from the reader, and
   * concatenates the chunks into a single ArrayBuffer.
   *
   * @returns A promise resolving to the gzip-compressed ArrayBuffer.
   * @throws {Error} if the compressor has already been flushed.
   */
  async flush(): Promise<ArrayBuffer> {
    if (this.closed) {
      throw new Error(
        "StreamingCompressor: already flushed. Call reset() to start a new chunk.",
      );
    }

    return measureTime("flush", async () => {
      await this.writer.close();

      const chunks: Uint8Array[] = [];
      let total = 0;

      while (true) {
        const { done, value } = await this.reader!.read();
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

      this.closed = true;
      return out.buffer;
    });
  }

  /**
   * Resets the compressor for a new chunk. Creates a fresh CompressionStream,
   * writer, and reader. Can only be called after flush().
   */
  reset(): void {
    if (!this.closed) {
      throw new Error(
        "StreamingCompressor: cannot reset before flushing. Call flush() first.",
      );
    }

    this.stream = new CompressionStream("gzip");
    this.writer = this.stream.writable.getWriter();
    this.reader = this.stream.readable.getReader();
    this.closed = false;
  }
}
