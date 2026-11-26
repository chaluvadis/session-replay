/**
 * App component for the Dumb Pipe replay UI.
 *
 * Sets up React Router with two routes:
 *  - /          -> SessionList
 *  - /session/:id -> ReplayPlayer
 */

import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import SessionList from "./components/SessionList";
import ReplayPlayer from "./components/ReplayPlayer";
import RecordPage from "./components/RecordPage";

export default function App() {
  const navigate = useNavigate();

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
        <Routes>
          <Route path="/" element={<SessionList />} />
          <Route path="/session/:id" element={<ReplayPlayer />} />
          <Route path="/record" element={<RecordPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
