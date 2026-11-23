import { useState, useEffect } from "react";
import ListPage from "./pages/ListPage";
import ReplayPage from "./pages/ReplayPage";

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onNavigate = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onNavigate);
    return () => window.removeEventListener("popstate", onNavigate);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState({}, "", to);
    setPath(to);
  };

  return (
    <div className="app">
      <nav className="navbar">
        <a href="#" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
          Dumb Pipe
        </a>
        <span className="spacer" />
        <a href="#" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
          Sessions
        </a>
      </nav>

      <main className="container">
        {path === "/" || path === "/sessions" ? (
          <ListPage onSelect={(id) => navigate(`/sessions/${id}`)} />
        ) : path.startsWith("/sessions/") ? (
          <ReplayPage sessionId={path.split("/").slice(2).join("/")} />
        ) : (
          <ListPage onSelect={(id) => navigate(`/sessions/${id}`)} />
        )}
      </main>
    </div>
  );
}
