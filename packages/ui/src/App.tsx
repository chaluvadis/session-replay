/**
 * App component for the Dumb Pipe replay UI.
 *
 * Sets up React Router with two routes:
 *  - /          -> SessionList
 *  - /session/:id -> ReplayPlayer
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import SessionList from "./components/SessionList";
import ReplayPlayer from "./components/ReplayPlayer";

export default function App() {
  return (
    <BrowserRouter basename="/session-replay/">
      <div className="min-h-screen bg-dark-bg text-dark-text">
        <Routes>
          <Route path="/" element={<SessionList />} />
          <Route path="/session/:id" element={<ReplayPlayer />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
