/**
 * SessionRecorder orchestrates the full session replay recording lifecycle:
 * sampling, session registration, rrweb recording, streaming compression,
 * chunked uploads, and session completion.
 *
 * Designed for browser use only. No Node.js APIs.
 */

import { record } from "rrweb";
import { StreamingCompressor } from "./compressor";
import {
  DEFAULT_PRIVACY_CONFIG,
  PrivacyConfig,
  buildRrwebConfig,
  sanitizeUrl,
} from "./privacy";

/**
 * Configuration for the SessionRecorder.
 */
export interface RecorderConfig {
  /** Base URL of the Dumb Pipe API (e.g. "http://localhost:8080"). */
  apiEndpoint: string;
  /** Name of the application being recorded. */
  application: string;
  /** Deployment environment (e.g. "production", "staging"). */
  environment: string;
  /** Sampling rate between 0 and 1. Default: 0.1 (10%). */
  sampleRate?: number;
  /** Maximum recording duration in ms. Default: 300000 (5 minutes). */
  maxDurationMs?: number;
  /** Flush interval in ms. Default: 10000 (10 seconds). */
  flushIntervalMs?: number;
  /** Optional privacy/masking configuration overrides. */
  privacy?: Partial<PrivacyConfig>;
}

/**
 * Resolved recorder configuration with all defaults applied.
 */
interface ResolvedRecorderConfig {
  apiEndpoint: string;
  application: string;
  environment: string;
  sampleRate: number;
  maxDurationMs: number;
  flushIntervalMs: number;
}

/**
 * SessionRecorder manages recording, compressing, and uploading session
 * replay data to the Dumb Pipe backend.
 */
export class SessionRecorder {
  private readonly config: ResolvedRecorderConfig;
  private readonly privacy: PrivacyConfig;

  private sessionId: string | null = null;
  private compressor: StreamingCompressor | null = null;
  private chunkIndex = 0;
  private eventCount = 0;

  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private recorderStop: (() => void) | undefined = undefined;
  private started = false;
  private paused = false;

  constructor(config: RecorderConfig) {
    this.config = {
      apiEndpoint: config.apiEndpoint,
      application: config.application,
      environment: config.environment,
      sampleRate: config.sampleRate ?? 0.1,
      maxDurationMs: config.maxDurationMs ?? 300000,
      flushIntervalMs: config.flushIntervalMs ?? 10000,
    };
    this.privacy = { ...DEFAULT_PRIVACY_CONFIG, ...config.privacy };
  }

  /**
   * Starts the recording lifecycle.
   *
   * - Checks sampling rate; returns early if not sampled in.
   * - Validates CompressionStream availability.
   * - Generates a sessionId and registers the session via POST /api/sessions.
   * - Starts rrweb recording with the privacy configuration.
   * - Starts the periodic flush timer, max-duration timeout, visibility
   *   change handler, and beforeunload best-effort flush handler.
   */
  initialize(): void {
    // Sampling check
    if (Math.random() >= this.config.sampleRate) {
      return;
    }

    // CompressionStream availability guard
    if (typeof CompressionStream === "undefined") {
      console.error(
        "[SessionRecorder] CompressionStream is not available. Recording disabled.",
      );
      return;
    }

    this.sessionId = crypto.randomUUID();
    this.compressor = new StreamingCompressor();

    // Register session with the backend
    void this.registerSession().catch((err) => {
      console.error("[SessionRecorder] Failed to register session:", err);
    });

    // Start rrweb recording
    try {
      this.recorderStop = record({
        ...buildRrwebConfig(this.privacy),
        emit: (event: unknown) => {
          void this.handleEvent(event);
        },
      });
    } catch (err) {
      console.error("[SessionRecorder] Failed to start rrweb recording:", err);
      return;
    }

    // Start periodic flush
    this.scheduleFlush();

    // Max-duration auto-stop
    this.maxDurationTimer = setTimeout(() => {
      void this.stop();
    }, this.config.maxDurationMs);

    // Visibility change -> pause/resume
    document.addEventListener("visibilitychange", this.onVisibilityChange);

    // Beforeunload -> best-effort final flush
    window.addEventListener("beforeunload", this.onBeforeUnload);

    this.started = true;
  }

  /**
   * Stops recording, flushes the final chunk, and marks the session complete.
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    // Clear timers
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }

    // Stop rrweb recording
    if (this.recorderStop) {
      this.recorderStop();
      this.recorderStop = undefined;
    }

    // Remove DOM listeners
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    window.removeEventListener("beforeunload", this.onBeforeUnload);

    // Final flush + upload
    await this.flushAndUpload();

    // Mark session complete
    if (this.sessionId) {
      try {
        await fetch(
          `${this.config.apiEndpoint}/api/sessions/${this.sessionId}/complete`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
        );
      } catch (err) {
        console.error("[SessionRecorder] Failed to complete session:", err);
      }
    }

    this.started = false;
  }

  /**
   * Writes a single rrweb event to the streaming compressor and tracks count.
   */
  private handleEvent(event: unknown): Promise<void> {
    if (!this.compressor || this.paused) {
      return Promise.resolve();
    }

    this.eventCount += 1;
    const sanitized = this.sanitizeEvent(event);
    return this.compressor.writeEvent(sanitized);
  }

  /**
   * Flushes compressed data, obtains a presigned PUT URL, uploads the chunk,
   * and resets the compressor for the next chunk.
   */
  private async flushAndUpload(): Promise<void> {
    if (!this.compressor || !this.sessionId) {
      return;
    }

    let compressed: ArrayBuffer;
    try {
      compressed = await this.compressor.flush();
    } catch (err) {
      console.error("[SessionRecorder] Compressor flush failed:", err);
      return;
    }

    if (compressed.byteLength === 0) {
      return;
    }

    // Request presigned PUT URL
    let presigned: { uploadUrl: string; objectKey: string; expiresAt: string };
    try {
      const res = await fetch(`${this.config.apiEndpoint}/api/chunks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.sessionId,
          chunkIndex: this.chunkIndex,
          fileSize: compressed.byteLength,
        }),
      });

      if (!res.ok) {
        console.error(
          `[SessionRecorder] Presigned URL request failed: ${res.status}`,
        );
        return;
      }

      presigned = (await res.json()) as {
        uploadUrl: string;
        objectKey: string;
        expiresAt: string;
      };
    } catch (err) {
      console.error("[SessionRecorder] Failed to get presigned URL:", err);
      return;
    }

    // Upload compressed data to MinIO
    try {
      await fetch(presigned.uploadUrl, {
        method: "PUT",
        body: new Uint8Array(compressed),
        headers: { "Content-Type": "application/gzip" },
      });
    } catch (err) {
      console.error("[SessionRecorder] Chunk upload failed:", err);
      return;
    }

    // Reset compressor for next chunk
    try {
      this.compressor.reset();
    } catch (err) {
      console.error("[SessionRecorder] Compressor reset failed:", err);
    }

    this.chunkIndex += 1;
  }

  /**
   * Pauses event recording (called when tab becomes hidden).
   */
  private pause(): void {
    this.paused = true;
  }

  /**
   * Resumes event recording (called when tab becomes visible).
   */
  private resume(): void {
    this.paused = false;
  }

  /**
   * Starts the periodic flush interval timer.
   */
  private scheduleFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      void this.flushAndUpload();
    }, this.config.flushIntervalMs);
  }

  /**
   * Registers the session with the backend via POST /api/sessions.
   */
  private async registerSession(): Promise<void> {
    const pageUrl =
      typeof location !== "undefined"
        ? sanitizeUrl(location.href)
        : "";

    const res = await fetch(`${this.config.apiEndpoint}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: this.sessionId,
        application: this.config.application,
        environment: this.config.environment,
        url: pageUrl,
        userId: undefined,
        runId: undefined,
        metadata: {},
      }),
    });

    if (!res.ok) {
      throw new Error(`Session registration failed: ${res.status}`);
    }
  }

  /**
   * Recursively sanitizes sensitive data from an rrweb event before
   * compression. Currently scrubs URLs in the event payload.
   */
  private sanitizeEvent(event: unknown): object {
    if (typeof event !== "object" || event === null) {
      return event as object;
    }

    const obj = event as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (key === "url" && typeof value === "string") {
        result[key] = sanitizeUrl(value);
      } else if (typeof value === "object" && value !== null) {
        result[key] = this.sanitizeEvent(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.pause();
    } else {
      this.resume();
    }
  };

  private readonly onBeforeUnload = (): void => {
    // Best-effort flush on page unload. Cannot await async work here;
    // data may be lost if the tab closes before the timer fires.
    void this.flushAndUpload();
  };
}

/**
 * Factory function that creates a SessionRecorder, initializes it, and
 * returns the instance.
 *
 * @param config - Recorder configuration.
 * @returns An initialized SessionRecorder (may be a no-op if not sampled in
 *          or CompressionStream is unavailable).
 */
export function initSessionReplay(config: RecorderConfig): SessionRecorder {
  const recorder = new SessionRecorder(config);
  recorder.initialize();
  return recorder;
}
