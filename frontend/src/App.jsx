import { useState } from 'react';
import { Navigate, Route, Routes, Link, useNavigate } from 'react-router-dom';
import Register from './pages/Register.jsx';
import Login from './pages/Login.jsx';
import Search from './pages/Search.jsx';
import MyBookings from './pages/MyBookings.jsx';
import Admin from './pages/Admin.jsx';
import { apiFetch, clearSession, getToken, getUser } from './api/client.js';

function RequireAuth({ authed, children }) {
  return authed ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'admin' ? children : <Navigate to="/search" replace />;
}

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [user, setUserState] = useState(getUser());
  const navigate = useNavigate();

  async function signOut() {
    try {
      await apiFetch('/sessions/current', { method: 'DELETE' });
    } catch {
      // best-effort; clear the local session regardless
    }
    clearSession();
    setAuthed(false);
    setUserState(null);
    navigate('/login');
  }

  function onLogin(loggedInUser) {
    setUserState(loggedInUser);
    setAuthed(true);
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <nav aria-label="Main navigation">
        <Link className="nav-brand" to="/search">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="5" y="3" width="14" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M5 11h14" stroke="currentColor" strokeWidth="2" />
            <circle cx="9" cy="14" r="1.2" fill="currentColor" />
            <circle cx="15" cy="14" r="1.2" fill="currentColor" />
            <path d="M8 21l2-4M16 21l-2-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Railway Reservation
        </Link>
        <Link to="/search">Search</Link>
        {authed && <Link to="/my-bookings">My bookings</Link>}
        {authed && user?.role === 'admin' && <Link to="/admin">Admin</Link>}
        {authed ? (
          <>
            <span className="nav-user">{user?.name || user?.email}</span>
            <button type="button" onClick={signOut}>Sign out</button>
          </>
        ) : (
          <Link to="/login">Sign in</Link>
        )}
      </nav>

      <main id="main">
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login onLogin={onLogin} />} />
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
          <Route
            path="/admin"
            element={
              <RequireAdmin user={user}>
                <Admin />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<Navigate to="/search" replace />} />
        </Routes>
      </main>
    </div>
  );
}
