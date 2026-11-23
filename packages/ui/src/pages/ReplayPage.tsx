import ReplayPlayer from "../components/ReplayPlayer";

export default function ReplayPage({ sessionId }: { sessionId: string }) {
  const navigate = (to: string) => {
    window.history.pushState({}, "", to);
  };

  return (
    <div className="page replay-page">
      <nav className="navbar">
        <a href="#" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
          &larr; Sessions
        </a>
        <span className="spacer" />
        <span>Replay</span>
      </nav>
      <h1>Session {sessionId}</h1>
      <ReplayPlayer sessionId={sessionId} />
    </div>
  );
}
