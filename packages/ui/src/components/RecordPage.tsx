/**
 * RecordPage component for the Dumb Pipe replay UI.
 *
 * Provides a session configuration form, a recording dashboard with
 * real-time timer and upload progress, and auto-completes the session
 * when the tab becomes hidden. Built on the useRecording hook.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRecording } from "../hooks/useRecording";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export default function RecordPage() {
  const navigate = useNavigate();
  const { state, start, stop, complete, reset } = useRecording();
  const [config, setConfig] = useState({
    application: "web",
    environment: "development",
    userId: "",
    runId: "",
    metadata: {},
  });

  useEffect(() => {
    if (state.status === "completed" && state.sessionId) {
      navigate(`/session/${state.sessionId}`);
    }
  }, [state.status, state.sessionId, navigate]);

  if (state.status === "idle" && !state.sessionId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-16 h-16 bg-dark-surface rounded-full flex items-center justify-center border border-dp-500/30">
          <svg className="w-9 h-9 text-dp-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-dark-text">Record a Session</h1>
        <p className="text-dark-muted text-sm max-w-xs">
          Configure and start recording user interactions. Sessions upload in
          10-second gzip-compressed chunks to the API.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void start({
              application: config.application,
              environment: config.environment,
              userId: config.userId || undefined,
              runId: config.runId || undefined,
              metadata: config.metadata,
            });
          }}
          className="flex flex-col gap-4 w-full max-w-md px-4"
        >
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider">
              Application
            </label>
            <input
              value={config.application}
              onChange={(e) => setConfig({ ...config, application: e.target.value })}
              className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm text-dark-text focus:outline-none focus:border-dp-500 transition-colors"
              placeholder="web"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider">
              Environment
            </label>
            <input
              value={config.environment}
              onChange={(e) => setConfig({ ...config, environment: e.target.value })}
              className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm text-dark-text focus:outline-none focus:border-dp-500 transition-colors"
              placeholder="development"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider">
              User ID (optional)
            </label>
            <input
              value={config.userId}
              onChange={(e) => setConfig({ ...config, userId: e.target.value })}
              className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm text-dark-text focus:outline-none focus:border-dp-500 transition-colors"
              placeholder="user-123"
            />
          </div>
          <button
            type="submit"
            disabled={state.status !== "idle"}
            className="px-6 py-3 bg-dp-500 hover:bg-dp-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start Recording
          </button>
        </form>

        <div className="text-xs text-dark-muted">
          Sessions auto-complete when you switch tabs or close the page.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 ${
        state.status === "recording"
          ? "border-dp-500/30 border-t-dp-500 animate-spin"
          : "border-dark-border"
      }`}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center">
          {state.status === "recording" ? (
            <div className="w-4 h-4 bg-rose-500 rounded-full animate-pulse" />
          ) : (
            <svg className="w-4 h-4 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-dark-text">
          {state.status === "recording" ? "Recording…" : state.status.charAt(0).toUpperCase() + state.status.slice(1)}
        </h1>
        <span className="text-dark-text font-mono text-sm">{state.sessionId ?? "—"}</span>
        <span className="text-dark-muted text-xs">
          {formatElapsed(state.elapsedMs)} • {state.chunksUploaded} chunk{state.chunksUploaded !== 1 ? "s" : ""} uploaded
        </span>
      </div>

      {state.error && (
        <div className="text-rose-400 text-sm font-medium bg-rose-500/10 px-3 py-2 rounded border border-rose-500/20">
          {state.error}
        </div>
      )}

      <div className="flex gap-3">
        {state.status === "recording" ? (
          <>
            <button
              onClick={stop}
              className="px-5 py-2 bg-dark-surface hover:bg-dark-surface/80 text-dark-text font-medium rounded-lg border border-dark-border transition-colors"
            >
              Stop
            </button>
            <button
              onClick={complete}
              className="px-5 py-2 bg-dp-500 hover:bg-dp-600 text-white font-medium rounded-lg transition-colors"
            >
              Complete Session
            </button>
          </>
        ) : (
          <>
            <button
              onClick={reset}
              className="px-5 py-2 bg-dark-surface hover:bg-dark-surface/80 text-dark-text font-medium rounded-lg border border-dark-border transition-colors"
            >
              Record New
            </button>
          </>
        )}
      </div>

      {state.status === "completed" && state.sessionId && (
        <div className="mt-4">
          <Link
            to={`/session/${state.sessionId}`}
            className="text-dp-400 text-sm hover:text-dp-500 underline font-medium"
          >
            View replay →
          </Link>
        </div>
      )}
    </div>
  );
}
