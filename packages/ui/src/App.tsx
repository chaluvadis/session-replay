/**
 * App component for the Dumb Pipe replay UI.
 *
 * Sets up React Router with a shell layout (header + routes) and
 * handles GitHub Pages SPA fallback routing.
 */

import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import SessionList from "./components/SessionList";
import ReplayPlayer from "./components/ReplayPlayer";
import RecordPage from "./components/RecordPage";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // SPA fallback for GitHub Pages: if sessionStorage has a preserved
  // path (from 404.html), navigate to it on first load.
  useEffect(() => {
    const redirect = sessionStorage.getItem("spa-redirect");
    if (redirect) {
      const basename = "/session-replay/";
      const path = redirect.startsWith(basename)
        ? redirect.slice(basename.length - 1)
        : redirect;
      sessionStorage.removeItem("spa-redirect");
      navigate(path, { replace: true });
    }
  }, [navigate]);

  return (
    <BrowserRouter basename="/session-replay/">
      <div className="min-h-screen bg-dark-bg text-dark-text">
        <header className="border-b border-dark-border bg-dark-bg/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-dp-500 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-dark-text tracking-tight">DumbPipe</span>
              </div>
              <nav className="flex items-center gap-1">
                <Link
                  to="/"
                  className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    location.pathname === "/"
                      ? "bg-dp-500/20 text-dp-400 border border-dp-500/30"
                      : "text-dark-muted hover:text-dark-text hover:bg-dark-surface/50"
                  }`}
                >
                  Sessions
                </Link>
                <Link
                  to="/record"
                  className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    location.pathname === "/record"
                      ? "bg-dp-500/20 text-dp-400 border border-dp-500/30"
                      : "text-dark-muted hover:text-dark-text hover:bg-dark-surface/50"
                  }`}
                >
                  Record
                </Link>
              </nav>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<SessionList />} />
            <Route path="/session/:id" element={<ReplayPlayer />} />
            <Route path="/record" element={<RecordPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
