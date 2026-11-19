const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const auditService = require('./auditService');
const { AppError } = require('../middleware/errors');

const SESSION_TTL_MS = 30 * 60 * 1000; // SEC-03: 30 min inactivity expiry
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);
const MAX_FAILED_ATTEMPTS = 5; // SEC-04
const LOCKOUT_MS = 15 * 60 * 1000;

// FR-01: unique email, name, password >= 12 chars. Rejects a missing name, an 11-char password
// or a duplicate email without creating an account.
async function register({ name, email, password, requestId }) {
  if (!name || !name.trim() || !email || !password || password.length < 12) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Name, email and a password of at least 12 characters are required.'
    );
  }
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existing.rows.length > 0) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with that email already exists.');
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS); // SEC-02: salted adaptive hash
  const { rows } = await pool.query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role',
    [name.trim(), normalizedEmail, passwordHash]
  );
  const user = rows[0];
  await auditService.record(pool, { actorId: user.id, action: 'register', outcome: 'success', requestId });
  return user;
}

// FR-02: generic error on bad credentials, never reveals whether the account exists.
// SEC-04: five failures in 15 minutes lock the account for 15 minutes.
async function login({ email, password, requestId }) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
  const user = rows[0];

  if (user?.locked_until && new Date(user.locked_until) > new Date()) {
    await auditService.record(pool, { actorId: user.id, action: 'login', outcome: 'locked', requestId });
    throw new AppError(
      429,
      'ACCOUNT_LOCKED',
      'Too many failed sign-in attempts. Try again in 15 minutes.'
    );
  }

  const valid = user ? await bcrypt.compare(password || '', user.password_hash) : false;
  if (!valid) {
    if (user) {
      const locked = user.failed_attempts + 1 >= MAX_FAILED_ATTEMPTS;
      await pool.query(
        `UPDATE users
         SET failed_attempts = CASE WHEN $1 THEN 0 ELSE failed_attempts + 1 END,
             locked_until = CASE WHEN $1 THEN now() + interval '15 minutes' ELSE locked_until END
         WHERE id = $2`,
        [locked, user.id]
      );
      if (locked) {
        await auditService.record(pool, { actorId: user.id, action: 'account_lockout', outcome: 'locked', requestId });
      }
    }
    await auditService.record(pool, { actorId: user?.id ?? null, action: 'login', outcome: 'failure', requestId });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  await pool.query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [
    token,
    user.id,
    expiresAt,
  ]);
  await auditService.record(pool, { actorId: user.id, action: 'login', outcome: 'success', requestId });
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
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
    `SELECT s.user_id, s.expires_at, u.name, u.email, u.role
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1`,
    [token]
  );
  const session = rows[0];
  if (!session || session.expires_at < new Date()) return null;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query('UPDATE sessions SET expires_at = $1 WHERE token = $2', [expiresAt, token]);
  return { id: session.user_id, name: session.name, email: session.email, role: session.role };
}

module.exports = { register, login, logout, verifySession };
