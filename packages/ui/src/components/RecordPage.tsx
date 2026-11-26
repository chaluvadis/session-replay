/**
 * RecordPage component for the Dumb Pipe replay UI.
 *
 * Integrates @dumb-pipe/sdk to record user sessions. Provides Start/Stop/Complete
 * controls and displays the active session ID. Recorded sessions are uploaded in
 * 10-second gzip chunks to the Go API via presigned MinIO URLs.
 */

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DumbPipeSDK from "@dumb-pipe/sdk";

const sdk = new DumbPipeSDK({ baseUrl: "https://session-replay.fly.dev" });

export default function RecordPage() {
  const navigate = useNavigate()
  const [recording, setRecording] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [status, setStatus] = useState<string>("idle")
  const [error, setError] = useState<string | null>(null)
  const sdkRef = useRef<DumbPipeSDK>(sdk)

  useEffect(() => {
    setSessionId(sdkRef.current.getSessionId())
  }, [])

  const handleStart = async () => {
    setError(null)
    setStatus("recording")
    try {
      const result = await sdkRef.current.start()
      setRecording(true)
      setSessionId(result.sessionId)
    } catch (err: unknown) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Failed to start recording")
    }
  }

  const handleStop = async () => {
    try {
      await sdkRef.current.stop()
      setRecording(false)
      setStatus("stopped")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to stop recording")
    }
  }

  const handleComplete = async () => {
    setStatus("completing")
    try {
      await sdkRef.current.complete()
      setRecording(false)
      setStatus("completed")
    } catch (err: unknown) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Failed to complete session")
    }
  }

  const handleDestroy = () => {
    sdkRef.current.destroy()
    setRecording(false)
    setStatus("idle")
    setSessionId(null)
  }

  if (status === "idle") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-16 h-16 bg-dark-surface rounded-full flex items-center justify-center border border-dp-500/30">
          <svg className="w-8 h-8 text-dp-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-dark-text">Record a Session</h1>
        <p className="text-dark-muted text-sm max-w-xs">
          Capture user interactions and upload them for replay. Recording starts
          a new session and uploads 10-second gzip-compressed chunks to the API.
        </p>
        <button
          onClick={handleStart}
          className="px-6 py-3 bg-dp-500 hover:bg-dp-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          Start Recording
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className="w-16 h-16 rounded-full flex items-center justify-center border-4 border-dp-500/30 border-t-dp-500 animate-spin">
        <svg className="w-8 h-8 text-dp-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-xl font-semibold text-dark-text">Recording…</h1>
      <div className="flex flex-col gap-2">
        <span className="text-dark-text font-mono text-sm">{sessionId ?? "—"}</span>
        <span className="text-dark-muted text-xs capitalize">{status}</span>
      </div>

      {error && (
        <div className="text-rose-400 text-sm font-medium bg-rose-500/10 px-3 py-1 rounded">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleStop}
          disabled={!recording}
          className="px-5 py-2 bg-dark-surface hover:bg-dark-surface/80 text-dark-text font-medium rounded-lg border border-dark-border transition-colors"
        >
          Stop
        </button>
        <button
          onClick={handleComplete}
          disabled={!recording}
          className="px-5 py-2 bg-dp-500 hover:bg-dp-600 text-white font-medium rounded-lg transition-colors"
        >
          Complete Session
        </button>
      </div>

      <div className="mt-4">
        <Link
          to="/"
          className="text-dp-400 text-sm hover:text-dp-500 underline"
        >
          View all sessions
        </Link>
      </div>

      <button
        onClick={handleDestroy}
        className="mt-6 text-dark-muted text-xs hover:text-dark-text"
      >
        Reset
      </button>
    </div>
  )
}
