const request = require('supertest');
const createApp = require('../src/app');
const { pool, resetDb, seedUser } = require('./testDb');

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe('session security (SEC-03)', () => {
  test('an expired session is rejected', async () => {
    const token = await seedUser();
    await pool.query("UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE token = $1", [token]);
    const res = await request(app).get('/api/bookings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  test('a token is valid before expiry and rejected after sign-out (replay)', async () => {
    const token = await seedUser();
    const before = await request(app).get('/api/bookings').set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);

    const out = await request(app).delete('/api/sessions/current').set('Authorization', `Bearer ${token}`);
    expect(out.status).toBe(204);

    const replay = await request(app).get('/api/bookings').set('Authorization', `Bearer ${token}`);
    expect(replay.status).toBe(401);
  });

  test('a missing or malformed token is rejected without leaking details', async () => {
    const missing = await request(app).get('/api/bookings');
    const malformed = await request(app).get('/api/bookings').set('Authorization', 'Basic abc');
    expect(missing.status).toBe(401);
    expect(malformed.status).toBe(401);
    expect(missing.body.code).toBe('UNAUTHENTICATED');
  });

  test('access control is enforced server-side, not by the UI (SEC-01)', async () => {
    const passenger = await seedUser({ role: 'passenger' });
    const adminOnly = await request(app)
      .get('/api/admin/trips')
      .set('Authorization', `Bearer ${passenger}`);
    expect(adminOnly.status).toBe(403);
    expect(adminOnly.body.code).toBe('FORBIDDEN');
  });

  test('responses and audit rows never contain a password (SEC-02)', async () => {
    const password = 'correctpassword123';
    const email = 'leak@example.com';
    await request(app).post('/api/register').send({ name: 'Leak Test', email, password });
    const login = await request(app).post('/api/sessions').send({ email, password });
    expect(JSON.stringify(login.body)).not.toContain(password);

    const { rows } = await pool.query('SELECT * FROM audit_events');
    expect(JSON.stringify(rows)).not.toContain(password);
  });
});
