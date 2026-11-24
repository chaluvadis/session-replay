/**
 * ReplayPlayer component for the Dumb Pipe replay UI.
 *
 * Reads sessionId from the URL params, fetches and decompresses chunk
 * events via the chunk loader, and renders them using rrweb-player.
 * Shows a loading spinner while chunks are being fetched and cleans up
 * on unmount.
 */

import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Player } from "rrweb-player";
import "rrweb-player/dist/style.css";
import type { eventWithTime } from "@rrweb/types";
import { getSessionChunks } from "../api";

export default function ReplayPlayer() {
  const { id: sessionIdParam } = useParams<{ id: string }>()
  const sessionId = sessionIdParam ?? ""
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)
  const [events, setEvents] = useState<eventWithTime[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chunkProgress, setChunkProgress] = useState<{ loaded: number; total: number }>({ loaded: 0, total: 0 })

  useEffect(() => {
    let cancelled = false
    let abortController: AbortController | null = null

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await getSessionChunks(sessionId)
        const chunks = response.chunks ?? []

        setChunkProgress({ loaded: 0, total: chunks.length })

        // Fetch chunks in parallel with progress tracking
        const eventArrays = await Promise.all(
          chunks.map(async (chunk) => {
            abortController = new AbortController()
            const res = await fetch(chunk.presignedUrl, {
              signal: abortController.signal,
            })
            if (!res.ok) {
              throw new Error(`Failed to fetch chunk: ${res.status}`)
            }
            const buffer = await res.arrayBuffer()
            const bytes = new Uint8Array(buffer)

            // Decompress gzip
            const stream = new DecompressionStream("gzip")
            const writer = stream.writable.getWriter()
            await writer.write(bytes as unknown as BufferSource)
            writer.close()

            const reader = stream.readable.getReader()
            const decompressedChunks: Uint8Array[] = []
            let total = 0

            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              if (value) {
                decompressedChunks.push(value)
                total += value.byteLength
              }
            }

            const out = new Uint8Array(total)
            let offset = 0
            for (const c of decompressedChunks) {
              out.set(c, offset)
              offset += c.byteLength
            }

            const text = new TextDecoder().decode(out)
            const chunkEvents: unknown[] = []
            for (const line of text.split("\n")) {
              const trimmed = line.trim()
              if (!trimmed) continue
              try {
                chunkEvents.push(JSON.parse(trimmed))
              } catch {
                // skip malformed lines
              }
            }

            if (!cancelled) {
              setChunkProgress((prev) => ({ loaded: prev.loaded + 1, total: prev.total }))
            }

            return chunkEvents
          }),
        )

        if (cancelled) return

        const allEvents = eventArrays.flat()
        allEvents.sort((a, b) => {
          const ta = (a as { timestamp?: number }).timestamp ?? 0
          const tb = (b as { timestamp?: number }).timestamp ?? 0
          return ta - tb
        })

        setEvents(allEvents as eventWithTime[])
      } catch (err: unknown) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load replay")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
      abortController?.abort()
      if (playerRef.current) {
        ;(playerRef.current as any).destroy()
        playerRef.current = null
      }
    }
  }, [sessionId])

  useEffect(() => {
    if (playerRef.current) {
      ;(playerRef.current as any).destroy()
      playerRef.current = null
    }

    if (containerRef.current && events.length > 0) {
      playerRef.current = new Player({
        target: containerRef.current,
        props: { events },
      })
    }

    return () => {
      if (playerRef.current) {
        ;(playerRef.current as any).destroy()
        playerRef.current = null
      }
    }
  }, [events])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-10 h-10 border-4 border-dp-500/30 border-t-dp-500 rounded-full animate-spin mb-4"></div>
        <p className="text-dp-400 text-sm font-medium">Loading chunks…</p>
        {chunkProgress.total > 0 && (
          <p className="text-dark-muted text-xs mt-1">
            {chunkProgress.loaded} / {chunkProgress.total}
          </p>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-rose-400 text-sm font-medium mb-2">Failed to load replay</p>
        <p className="text-dark-muted text-xs max-w-xs">{error}</p>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-12 h-12 bg-dark-surface rounded-full flex items-center justify-center mb-4 opacity-50">
          <svg className="w-6 h-6 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.749 18.248a6 6 0 01-1.794-10.001A6 6 0 0013.248 11c0 1.61-.89 3.049-2.24 3.875a1 1 0 01-1.515.112L7.23 17.25a3 3 0 01-4.172-4.172l1.242-1.242a1 1 0 011.515-.112c1.13-.819 2.886-1.106 4.243-.842a6 6 0 013.807 2.207zM13 15a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 className="text-dark-text text-lg font-medium">No events to replay</h2>
        <p className="text-dark-muted text-sm">This session has no recorded events.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-dark-text">Session Replay</h1>
        <div className="text-xs text-dark-muted font-mono">
          {sessionId.slice(0, 8)}…{sessionId.slice(-4)}
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-dark-border bg-dark-surface overflow-hidden relative">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  )
}
