const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const auditService = require('./auditService');
const { AppError } = require('../middleware/errors');

const SESSION_TTL_MS = 30 * 60 * 1000; // SEC-03: 30 min inactivity expiry
const BCRYPT_ROUNDS = 12;

// FR-01: unique email, name, password >= 12 chars. Rejects an 11-char password or duplicate
// email without creating an account.
async function register({ email, password, requestId }) {
  if (!email || !password || password.length < 12) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Email and a password of at least 12 characters are required.');
  }
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existing.rows.length > 0) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with that email already exists.');
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS); // SEC-02: salted adaptive hash
  const { rows } = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role',
    [normalizedEmail, passwordHash]
  );
  const user = rows[0];
  await auditService.record(pool, { actorId: user.id, action: 'register', outcome: 'success', requestId });
  return user;
}

// FR-02: generic error on bad credentials, never reveals whether the account exists.
async function login({ email, password, requestId }) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
  const user = rows[0];
  const valid = user ? await bcrypt.compare(password || '', user.password_hash) : false;
  if (!valid) {
    await auditService.record(pool, { actorId: user?.id ?? null, action: 'login', outcome: 'failure', requestId });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [
    token,
    user.id,
    expiresAt,
  ]);
  await auditService.record(pool, { actorId: user.id, action: 'login', outcome: 'success', requestId });
  return { token, user: { id: user.id, email: user.email, role: user.role } };
}

async function logout({ token, requestId }) {
  const { rows } = await pool.query('DELETE FROM sessions WHERE token = $1 RETURNING user_id', [token]);
  if (rows[0]) {
    await auditService.record(pool, { actorId: rows[0].user_id, action: 'logout', outcome: 'success', requestId });
  }
}

// Slides the expiry forward on each authenticated request; returns null for a missing/expired
// session so middleware can respond 401 without leaking which case it was.
async function verifySession(token) {
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT s.user_id, s.expires_at, u.email, u.role
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1`,
    [token]
  );
  const session = rows[0];
  if (!session || session.expires_at < new Date()) return null;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query('UPDATE sessions SET expires_at = $1 WHERE token = $2', [expiresAt, token]);
  return { id: session.user_id, email: session.email, role: session.role };
}

module.exports = { register, login, logout, verifySession };
