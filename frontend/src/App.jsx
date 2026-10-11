import { useState } from 'react';
import { Navigate, Route, Routes, Link } from 'react-router-dom';
import Register from './pages/Register.jsx';
import Login from './pages/Login.jsx';
import Search from './pages/Search.jsx';
import MyBookings from './pages/MyBookings.jsx';
import { apiFetch, getToken, setToken } from './api/client.js';

function RequireAuth({ authed, children }) {
  return authed ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));

  async function signOut() {
    try {
      await apiFetch('/sessions/current', { method: 'DELETE' });
    } catch {
      // best-effort; clear the local token regardless
    }
    setToken(null);
    setAuthed(false);
  }

  return (
    <div>
      <nav>
        <Link to="/search">Search</Link>
        <Link to="/my-bookings">My bookings</Link>
        {authed ? (
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        ) : (
          <Link to="/login">Sign in</Link>
        )}
      </nav>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login onLogin={() => setAuthed(true)} />} />
        <Route
          path="/search"
          element={
            <RequireAuth authed={authed}>
              <Search />
            </RequireAuth>
          }
        />
        <Route
          path="/my-bookings"
          element={
            <RequireAuth authed={authed}>
              <MyBookings />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/search" replace />} />
      </Routes>
    </div>
  );
}
