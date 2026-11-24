import { record } from "rrweb";
import { eventsToNdjsonBytes, gzipUint8Array } from "./compress";
import { ApiClient } from "./client";

type RrwebEvent = Record<string, unknown>;

export interface DumbPipeSDKOptions {
  baseUrl?: string;
  flushIntervalMs?: number;
  sessionId?: string;
  application?: string;
  environment?: string;
}

export interface StartResult {
  sessionId: string;
}

export class DumbPipeSDK {
  private baseUrl: string;
  private flushIntervalMs: number;
  private api: ApiClient;

  private sessionId: string | null = null;
  private events: RrwebEvent[] = [];
  private chunkIndex = 0;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private recorderStop: (() => void) | null = null;
  private started = false;

  constructor(options: DumbPipeSDKOptions = {}) {
    this.baseUrl = options.baseUrl ?? "http://localhost:8080";
    this.flushIntervalMs = options.flushIntervalMs ?? 10000;
    this.api = new ApiClient(this.baseUrl);
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  async start(options?: { sessionId?: string }): Promise<StartResult> {
    if (this.started) {
      return { sessionId: this.sessionId as string };
    }

    let sessionId = options?.sessionId ?? this.sessionId;

    if (!sessionId) {
      const res = await this.api.createSession({
        application: "web",
        environment: "development",
      });
      sessionId = res.sessionId;
    }

    this.sessionId = sessionId;
    this.started = true;

    this.recorderStop = record({
      emit: (event: unknown) => {
        this.events.push(event as RrwebEvent);
      },
    }) ?? null;

    this.scheduleFlush();

    return { sessionId };
  }

  private scheduleFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
  }

  async flush(): Promise<void> {
    if (!this.sessionId) return;
    const batch = this.events.splice(0, this.events.length);
    if (batch.length === 0) return;

    const ndjson = eventsToNdjsonBytes(batch);
    const compressed = await gzipUint8Array(ndjson);
    const objectKey = `${this.sessionId}/${String(this.chunkIndex).padStart(6, "0")}.gz`;

    const presigned = await this.api.presignedPutChunk({
      sessionId: this.sessionId,
      chunkIndex: this.chunkIndex,
      objectKey,
      sizeBytes: compressed.byteLength,
    });

    await fetch(presigned.uploadUrl, {
      method: "PUT",
      body: new Uint8Array(compressed),
      headers: { "Content-Type": "application/gzip" },
    });

    this.chunkIndex += 1;
  }

  async stop(): Promise<void> {
    await this.flush();
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.recorderStop) {
      this.recorderStop();
      this.recorderStop = null;
    }
    this.started = false;
  }

  async complete(): Promise<void> {
    await this.stop();
    if (!this.sessionId) return;
    await this.api.completeSession(this.sessionId);
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.recorderStop) {
      this.recorderStop();
      this.recorderStop = null;
    }
    this.started = false;
  }
}

export { DumbPipeSDK as default };
