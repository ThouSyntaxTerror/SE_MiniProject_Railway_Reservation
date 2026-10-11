import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client.js';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/register', { method: 'POST', body: { email, password } });
      navigate('/login');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Register</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="password">Password (12+ characters)</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={12}
          required
        />
        <button type="submit">Create account</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      <p>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
