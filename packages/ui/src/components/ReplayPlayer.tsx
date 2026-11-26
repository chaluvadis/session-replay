/**
 * ReplayPlayer component for the Dumb Pipe replay UI.
 *
 * Fetches session metadata and chunk events, decompresses them via the
 * chunk loader, and renders them using rrweb-player. Shows session
 * metadata, playback speed control, retry support, and progress tracking.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Player } from "rrweb-player";
import "rrweb-player/dist/style.css";
import type { eventWithTime } from "@rrweb/types";
import { getSession, getSessionChunks } from "../api";
import { loadSessionEvents } from "../utils/chunkLoader";

function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms?: number): string {
  if (!ms) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export default function ReplayPlayer() {
  const { id: sessionIdParam } = useParams<{ id: string }>();
  const sessionId = sessionIdParam ?? "";
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [events, setEvents] = useState<eventWithTime[]>([]);
  const [session, setSession] = useState<{
    sessionId: string;
    application: string;
    environment: string;
    url: string;
    status: string;
    startedAt: string;
    durationMs?: number;
    totalChunks?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chunkProgress, setChunkProgress] = useState<{
    loaded: number;
    total: number;
  }>({ loaded: 0, total: 0 });
  const [retryCount, setRetryCount] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const load = useCallback(async (retry = false) => {
    setLoading(true);
    setError(null);

    try {
      // Fetch session metadata
      const sessionData = await getSession(sessionId);
      setSession({
        sessionId: sessionData.sessionId,
        application: sessionData.application,
        environment: sessionData.environment,
        url: sessionData.url,
        status: sessionData.status,
        startedAt: sessionData.startedAt,
        durationMs: sessionData.durationMs,
        totalChunks: sessionData.totalChunks,
      });

      // Fetch chunks
      const response = await getSessionChunks(sessionId);
      const chunks = response.chunks ?? [];

      setChunkProgress({ loaded: 0, total: chunks.length });

      // Fetch chunks in parallel with progress tracking
      const eventArrays = await Promise.all(
        chunks.map(async (chunk) => {
          const res = await fetch(chunk.presignedUrl);
          if (!res.ok) {
            throw new Error(`Failed to fetch chunk: ${res.status}`);
          }
          const buffer = await res.arrayBuffer();
          const bytes = new Uint8Array(buffer);

          // Decompress gzip
          const stream = new DecompressionStream("gzip");
          const writer = stream.writable.getWriter();
          await writer.write(bytes as unknown as BufferSource);
          writer.close();

          const reader = stream.readable.getReader();
          const decompressedChunks: Uint8Array[] = [];
          let total = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              decompressedChunks.push(value);
              total += value.byteLength;
            }
          }

          const out = new Uint8Array(total);
          let offset = 0;
          for (const c of decompressedChunks) {
            out.set(c, offset);
            offset += c.byteLength;
          }

          const text = new TextDecoder().decode(out);
          const chunkEvents: unknown[] = [];
          for (const line of text.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              chunkEvents.push(JSON.parse(trimmed));
            } catch {
              // skip malformed lines
            }
          }

          setChunkProgress((prev) => ({ loaded: prev.loaded + 1, total: prev.total }));
          return chunkEvents;
        }),
      );

      const allEvents = eventArrays.flat();
      allEvents.sort((a, b) => {
        const ta = (a as { timestamp?: number }).timestamp ?? 0;
        const tb = (b as { timestamp?: number }).timestamp ?? 0;
        return ta - tb;
      });

      setEvents(allEvents as eventWithTime[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load replay");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load, sessionId]);

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
    void load(true);
  };

  useEffect(() => {
    if (playerRef.current) {
      ;(playerRef.current as any).destroy();
      playerRef.current = null;
    }

    if (containerRef.current && events.length > 0) {
      playerRef.current = new Player({
        target: containerRef.current,
        props: { events },
      });
    }

    return () => {
      if (playerRef.current) {
        ;(playerRef.current as any).destroy();
        playerRef.current = null;
      }
    };
  }, [events, playbackRate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-10 h-10 border-4 border-dp-500/30 border-t-dp-500 rounded-full animate-spin mb-4"></div>
        <p className="text-dp-400 text-sm font-medium">Loading session…</p>
        {chunkProgress.total > 0 && (
          <p className="text-dark-muted text-xs mt-1">
            {chunkProgress.loaded} / {chunkProgress.total} chunks
          </p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-3">
        <p className="text-rose-400 text-sm font-medium">Failed to load replay</p>
        <p className="text-dark-muted text-xs max-w-xs">{error}</p>
        <button
          onClick={handleRetry}
          className="px-4 py-2 bg-dp-500 hover:bg-dp-600 text-white text-xs font-medium rounded-lg transition-colors"
        >
          Retry
        </button>
        <Link
          to="/"
          className="text-dp-400 text-xs hover:text-dp-500 underline"
        >
          Back to sessions
        </Link>
      </div>
    );
  }

  if (!session || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-12 h-12 bg-dark-surface rounded-full flex items-center justify-center mb-4 opacity-50">
          <svg className="w-6 h-6 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.749 18.248a6 6 0 01-1.794-10.001A6 6 0 0013.248 11c0 1.61-.89 3.049-2.24 3.875a1 1 0 01-1.515.112L7.23 17.25a3 3 0 01-4.172-4.172l1.242-1.242a1 1 0 011.515-.112c1.13-.819 2.886-1.106 4.243-.842a6 6 0 013.807 2.207zM13 15a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 className="text-dark-text text-lg font-medium">No events to replay</h2>
        <p className="text-dark-muted text-sm">This session has no recorded events.</p>
        <Link
          to="/"
          className="text-dp-400 text-sm hover:text-dp-500 underline mt-4"
        >
          Back to sessions
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-dp-400 text-sm hover:text-dp-500 underline flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
            Sessions
          </Link>
          <span className="w-px h-4 bg-dark-border"></span>
          <h1 className="text-lg font-semibold text-dark-text">Session Replay</h1>
        </div>
        <div className="text-xs font-mono text-dark-muted">
          {session.sessionId.slice(0, 8)}…{session.sessionId.slice(-4)}
        </div>
      </div>

      {/* Session metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-dark-surface border border-dark-border rounded-lg p-3">
          <div className="text-xs text-dark-muted uppercase tracking-wider">Application</div>
          <div className="text-sm text-dark-text">{session.application}</div>
        </div>
        <div className="bg-dark-surface border border-dark-border rounded-lg p-3">
          <div className="text-xs text-dark-muted uppercase tracking-wider">Environment</div>
          <div className="text-sm text-dark-text capitalize">{session.environment}</div>
        </div>
        <div className="bg-dark-surface border border-dark-border rounded-lg p-3">
          <div className="text-xs text-dark-muted uppercase tracking-wider">Duration</div>
          <div className="text-sm font-mono text-dark-text">{formatDuration(session.durationMs)}</div>
        </div>
        <div className="bg-dark-surface border border-dark-border rounded-lg p-3">
          <div className="text-xs text-dark-muted uppercase tracking-wider">Started</div>
          <div className="text-sm text-dark-text">{formatTimestamp(session.startedAt)}</div>
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-dark-border bg-dark-surface overflow-hidden relative">
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <span className="text-xs text-dark-muted">Speed</span>
          <select
            value={playbackRate}
            onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
            className="bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs text-dark-text focus:outline-none focus:border-dp-500"
          >
            <option value="0.5">0.5x</option>
            <option value="1">1x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>
        <div ref={containerRef} className="w-full h-full" />
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-dark-muted">
        <span>
          {events.length} event{events.length !== 1 ? "s" : ""} • {session.totalChunks ?? 0} chunk{session.totalChunks !== 1 ? "s" : ""}
        </span>
        <Link
          to="/"
          className="text-dp-400 hover:text-dp-500 underline"
        >
          Back to sessions
        </Link>
      </div>
    </div>
  );
}
