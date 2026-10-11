const request = require('supertest');
const createApp = require('../src/app');
const { pool, resetDb } = require('./testDb');

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe('registration (FR-01)', () => {
  test('rejects an 11-character password', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ email: 'short@example.com', password: '12345678901' });
    expect(res.status).toBe(400);
    const { rows } = await pool.query('SELECT 1 FROM users WHERE email = $1', ['short@example.com']);
    expect(rows).toHaveLength(0);
  });

  test('rejects a duplicate email without creating a second account', async () => {
    const payload = { email: 'dup@example.com', password: 'longenoughpassword' };
    await request(app).post('/api/register').send(payload);
    const res = await request(app).post('/api/register').send(payload);
    expect(res.status).toBe(409);
    const { rows } = await pool.query('SELECT count(*)::int AS c FROM users WHERE email = $1', [payload.email]);
    expect(rows[0].c).toBe(1);
  });

  test('stores only a hash, never the plaintext password', async () => {
    const payload = { email: 'hash@example.com', password: 'longenoughpassword' };
    await request(app).post('/api/register').send(payload);
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', [payload.email]);
    expect(rows[0].password_hash).not.toBe(payload.password);
    expect(rows[0].password_hash.startsWith('$2')).toBe(true); // bcrypt hash prefix
  });
});

describe('login (FR-02)', () => {
  test('returns a generic error for both a missing account and a wrong password', async () => {
    const missing = await request(app)
      .post('/api/sessions')
      .send({ email: 'nobody@example.com', password: 'whatever12345' });
    await request(app).post('/api/register').send({ email: 'real@example.com', password: 'correctpassword123' });
    const wrong = await request(app)
      .post('/api/sessions')
      .send({ email: 'real@example.com', password: 'wrongpassword123' });

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(missing.body.message).toBe(wrong.body.message);
  });

  test('issues a session token on valid credentials', async () => {
    const payload = { email: 'login@example.com', password: 'correctpassword123' };
    await request(app).post('/api/register').send(payload);
    const res = await request(app).post('/api/sessions').send(payload);
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });
});
