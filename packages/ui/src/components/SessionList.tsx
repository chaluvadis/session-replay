/**
 * SessionList component for the Dumb Pipe replay UI.
 *
 * Fetches sessions from the API and renders a sleek dark-mode table.
 * Rows are clickable and navigate to the session replay page.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { SessionSummary } from "@dumb-pipe/types";
import { listSessions } from "../api";

/**
 * Truncate a session ID for display, showing the first 8 and last 4 chars.
 */
function truncateSessionId(id: string): string {
  if (id.length <= 12) return id
  return `${id.slice(0, 8)}…${id.slice(-4)}`
}

/**
 * Format an ISO timestamp for display.
 */
function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function SessionList() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    listSessions()
      .then((data) => {
        if (!cancelled) setSessions(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-dp-500/30 border-t-dp-500 rounded-full animate-spin"></div>
          <p className="text-dark-muted text-sm">Loading sessions…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-rose-400 text-sm font-medium mb-2">Failed to load sessions</p>
        <p className="text-dark-muted text-xs max-w-xs">{error}</p>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-12 h-12 bg-dark-surface rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-dark-text text-lg font-medium">No sessions recorded yet</h2>
        <p className="text-dark-muted text-sm">Start recording sessions to see them here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-dark-text text-balance">Sessions</h1>
        <span className="text-xs text-dark-muted px-2 py-1 bg-dark-surface rounded border border-dark-border">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-xl border border-dark-border bg-dark-surface shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-dark-bg/50">
              <th className="table-header w-32">Session ID</th>
              <th className="table-header">Application</th>
              <th className="table-header">Environment</th>
              <th className="table-header">Started At</th>
              <th className="table-header w-20">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {sessions.map((session) => (
              <Link
                key={session.sessionId}
                to={`/session/${session.sessionId}`}
                className="block hover:bg-dark-surface/30 transition-colors"
              >
                <tr className="tr-clickable group">
                  <td className="table-cell">
                    <div className="font-mono text-xs text-dark-text truncate max-w-[120px]">
                      {truncateSessionId(session.sessionId)}
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs text-dark-text">{session.application}</span>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs text-dark-text capitalize">
                      {session.environment}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs text-dark-muted">
                      {formatTimestamp(session.startedAt)}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span
                      className={`badge-status ${
                        session.status === "completed"
                          ? "badge-completed"
                          : session.status === "failed"
                            ? "badge-failed"
                            : "badge-active"
                      }`}
                    >
                      {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                    </span>
                  </td>
                </tr>
              </Link>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
