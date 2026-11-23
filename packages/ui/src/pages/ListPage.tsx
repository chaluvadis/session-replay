import { useState, useEffect } from "react";
import { api } from "../lib/api";

export default function ListPage({ onSelect }: { onSelect: (id: string) => void }) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listSessions()
      .then((res: any) => setSessions(res.sessions ?? []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading sessions...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="page">
      <h1>Sessions</h1>
      {sessions.length === 0 ? (
        <p className="empty">No sessions recorded yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Session ID</th>
              <th>Run ID</th>
              <th>Status</th>
              <th>Created At</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="clickable" onClick={() => onSelect(s.id)}>
                <td>{s.id}</td>
                <td>{s.run_id ?? "-"}</td>
                <td>
                  <span className={`badge ${s.status}`}>{s.status}</span>
                </td>
                <td>{new Date(s.created_at).toLocaleString()}</td>
                <td>Replay</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
