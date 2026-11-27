/**
 * SessionList component for the Dumb Pipe replay UI.
 *
 * Fetches sessions from the API with search, status filter, and
 * pagination support. Rows are clickable and navigate to the session
 * replay page. Includes refresh, empty state, and session metadata.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { SessionSummary } from "@dumb-pipe/types";
import { listSessions, type ListSessionsParams } from "../api";

function truncateSessionId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

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

export default function SessionList() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [pagination, setPagination] = useState<{ limit: number; offset: number; count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("completed");
  const [appFilter, setAppFilter] = useState("");
  const [envFilter, setEnvFilter] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: ListSessionsParams = {
        status: statusFilter && statusFilter !== "all" ? statusFilter : undefined,
        limit: 50,
        offset: 0,
      };
      if (appFilter) params.application = appFilter;
      if (envFilter) params.environment = envFilter;

      const data = await listSessions(params);

      // Client-side search filter on session ID
      const filtered = data.sessions.filter((s) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return s.sessionId.toLowerCase().includes(q) || s.application.toLowerCase().includes(q);
      });

      setSessions(filtered);
      setPagination(data.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter, appFilter, envFilter]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchSessions();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-dp-500/30 border-t-dp-500 rounded-full animate-spin"></div>
          <p className="text-dark-muted text-sm">Loading sessions…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-3">
        <p className="text-rose-400 text-sm font-medium">Failed to load sessions</p>
        <p className="text-dark-muted text-xs max-w-xs">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-dp-500 hover:bg-dp-600 text-white text-xs font-medium rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-12 h-12 bg-dark-surface rounded-full flex items-center justify-center mb-4 opacity-50">
          <svg className="w-6 h-6 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-dark-text text-lg font-medium">No sessions found</h2>
        <p className="text-dark-muted text-sm max-w-xs">
          {search ? "Try adjusting your search or filters." : "Start recording sessions to see them here."}
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-dp-500 hover:bg-dp-600 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Refresh
          </button>
          <Link
            to="/record"
            className="px-4 py-2 bg-dark-surface hover:bg-dark-surface/80 text-dark-text text-xs font-medium rounded-lg border border-dark-border transition-colors"
          >
            Record Session
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-dark-text">Sessions</h1>
          <span className="text-xs text-dark-muted px-2 py-1 bg-dark-surface rounded border border-dark-border">
            {sessions.length} of {pagination?.count ?? 0}
          </span>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto max-w-md lg:max-w-none">
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions…"
            className="w-full lg:w-48 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm text-dark-text focus:outline-none focus:border-dp-500 transition-colors"
          />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-2 bg-dark-surface hover:bg-dark-surface/80 text-dark-text font-medium rounded-lg border border-dark-border transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-2 text-dark-muted">
          Status:
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-dark-bg border border-dark-border rounded px-2 py-1 text-dark-text focus:outline-none focus:border-dp-500"
          >
            <option value="completed">Completed</option>
            <option value="recording">Recording</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-dark-muted">
          Application:
          <input
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            placeholder="app name"
            className="bg-dark-bg border border-dark-border rounded px-2 py-1 text-dark-text focus:outline-none focus:border-dp-500 w-24"
          />
        </label>
        <label className="flex items-center gap-2 text-dark-muted">
          Environment:
          <input
            value={envFilter}
            onChange={(e) => setEnvFilter(e.target.value)}
            placeholder="env"
            className="bg-dark-bg border border-dark-border rounded px-2 py-1 text-dark-text focus:outline-none focus:border-dp-500 w-20"
          />
        </label>
      </div>

      <div className="rounded-xl border border-dark-border bg-dark-surface shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-dark-bg/50">
              <th className="table-header w-40">Session ID</th>
              <th className="table-header w-32">Application</th>
              <th className="table-header w-24">Environment</th>
              <th className="table-header w-24">Status</th>
              <th className="table-header w-20">Duration</th>
              <th className="table-header w-20">Chunks</th>
              <th className="table-header w-24">Started At</th>
              <th className="table-header w-16 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {sessions.map((session) => (
              <Link
                key={session.sessionId}
                to={`/session/${session.sessionId}`}
                className="block hover:bg-dark-surface/30 transition-colors"
              >
                <tr className="group">
                  <td className="table-cell">
                    <div className="font-mono text-xs text-dark-text truncate max-w-[150px]">
                      {truncateSessionId(session.sessionId)}
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs text-dark-text">{session.application}</span>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs text-dark-muted capitalize">
                      {session.environment}
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
                  <td className="table-cell">
                    <span className="text-xs font-mono text-dark-muted">
                      {formatDuration(session.durationMs)}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs font-mono text-dark-muted">
                      {session.totalChunks ?? 0}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs text-dark-muted">
                      {formatTimestamp(session.startedAt)}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <svg
                      className="w-4 h-4 text-dark-muted group-hover:text-dp-400 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </td>
                </tr>
              </Link>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.count > sessions.length && (
        <div className="flex items-center justify-between text-xs text-dark-muted">
          <span>
            Showing {sessions.length} of {pagination.count} sessions
          </span>
          <button
            onClick={handleRefresh}
            className="text-dp-400 hover:text-dp-400 underline"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
