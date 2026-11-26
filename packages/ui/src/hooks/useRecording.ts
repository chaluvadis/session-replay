/**
 * Hook for managing DumbPipeSDK recording lifecycle with React state.
 *
 * Handles session creation, chunk flushing, upload progress, and
 * automatic completion on page visibility change.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import DumbPipeSDK from "@dumb-pipe/sdk";

export interface RecordingState {
  status: "idle" | "recording" | "stopped" | "completed" | "error";
  sessionId: string | null;
  chunksUploaded: number;
  bytesUploaded: number;
  error: string | null;
  elapsedMs: number;
}

export interface RecordingConfig {
  sessionId?: string;
  application?: string;
  environment?: string;
  userId?: string;
  runId?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export function useRecording() {
  const sdkRef = useRef<DumbPipeSDK | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<RecordingState>({
    status: "idle",
    sessionId: null,
    chunksUploaded: 0,
    bytesUploaded: 0,
    error: null,
    elapsedMs: 0,
  });

  const tick = useCallback(() => {
    const startTime = startTimeRef.current;
    if (startTime) {
      setState((prev) => ({ ...prev, elapsedMs: Date.now() - startTime }));
    }
  }, []);

  // Auto-complete recording when the tab becomes hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "hidden" &&
        sdkRef.current &&
        state.status === "recording"
      ) {
        void sdkRef.current.complete();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [sdkRef.current, state.status]);

  const start = useCallback(
    async (config: RecordingConfig = {}) => {
      setState({
        status: "recording",
        sessionId: null,
        chunksUploaded: 0,
        bytesUploaded: 0,
        error: null,
        elapsedMs: 0,
      });

      const sdk = new DumbPipeSDK({
        baseUrl:
          (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ??
          "https://session-replay.fly.dev",
      });
      sdkRef.current = sdk;

      try {
        const result = await sdk.start({
          sessionId: config.sessionId ?? undefined,
          application: config.application ?? "web",
          environment: config.environment ?? "development",
        userId: config.userId ?? undefined,
        runId: config.runId ?? undefined,
          metadata: config.metadata ?? {},
          url: config.url ?? typeof location !== "undefined" ? location.href : "",
        });

        startTimeRef.current = Date.now();
        timerRef.current = setInterval(tick, 1000);

        setState((prev) => ({
          ...prev,
          sessionId: result.sessionId,
          status: "recording",
        }));
      } catch (err: unknown) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: err instanceof Error ? err.message : "Failed to start recording",
        }));
      }
    },
    [tick],
  );

  const stop = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startTimeRef.current = null;

    try {
      await sdkRef.current?.stop();
      setState((prev) => ({ ...prev, status: "stopped" }));
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : "Failed to stop recording",
      }));
    }
  }, []);

  const complete = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startTimeRef.current = null;

    try {
      await sdkRef.current?.complete();
      setState((prev) => ({ ...prev, status: "completed" }));
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : "Failed to complete session",
      }));
    }
  }, []);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startTimeRef.current = null;
    sdkRef.current?.destroy();
    sdkRef.current = null;

    setState({
      status: "idle",
      sessionId: null,
      chunksUploaded: 0,
      bytesUploaded: 0,
      error: null,
      elapsedMs: 0,
    });
  }, []);

  return { state, start, stop, complete, reset };
}
