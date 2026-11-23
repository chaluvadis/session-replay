import { useRef, useEffect, useState, useCallback } from "react";
import { Player } from "rrweb-player";
import "rrweb-player/dist/style.css";
import type { eventWithTime } from "@rrweb/types";
import { api, fetchDecompressedChunk } from "../lib/api";
import type { RrwebEvent } from "@dumb-pipe/types";

export default function ReplayPlayer({ sessionId }: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [events, setEvents] = useState<RrwebEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSessionChunks(sessionId);
      const chunks = res.chunks ?? [];
      const allEvents: RrwebEvent[] = [];

      for (const chunk of chunks) {
        if (!chunk.url) continue;
        const chunkEvents = await fetchDecompressedChunk(chunk.url);
        allEvents.push(...(chunkEvents as RrwebEvent[]));
      }

      allEvents.sort((a, b) => a.timestamp - b.timestamp);
      setEvents(allEvents);
    } catch (err: any) {
      setError(err?.message || "Failed to load replay");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    if (containerRef.current && events.length > 0) {
      playerRef.current = new Player({
        target: containerRef.current,
        props: { events: events as unknown as eventWithTime[] },
      });
    }
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [events]);

  if (loading) return <div className="loading">Loading replay...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (events.length === 0) return <p className="empty">No events to replay.</p>;

  return (
    <div className="page replay-page">
      <h1>Replay: {sessionId}</h1>
      <div className="player-container" ref={containerRef} />
    </div>
  );
}
