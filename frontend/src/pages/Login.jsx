import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, setToken } from '../api/client.js';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const { token } = await apiFetch('/sessions', { method: 'POST', body: { email, password } });
      setToken(token);
      onLogin();
      navigate('/search');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Sign in</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Sign in</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      <p>
        Need an account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}
