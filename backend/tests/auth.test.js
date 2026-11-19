const request = require('supertest');
const createApp = require('../src/app');
const { pool, resetDb } = require('./testDb');

const app = createApp();
const VALID = { name: 'Asha Rao', email: 'asha@example.com', password: 'correctpassword123' };

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe('registration (FR-01)', () => {
  test('creates an account with name, unique email and a 12+ character password', async () => {
    const res = await request(app).post('/api/register').send(VALID);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe(VALID.name);
    expect(res.body.email).toBe(VALID.email);
    expect(res.body.password_hash).toBeUndefined();
  });

  test('rejects a missing name', async () => {
    const res = await request(app).post('/api/register').send({ email: VALID.email, password: VALID.password });
    expect(res.status).toBe(400);
    const { rows } = await pool.query('SELECT 1 FROM users WHERE email = $1', [VALID.email]);
    expect(rows).toHaveLength(0);
  });

  test('rejects an 11-character password', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ ...VALID, password: '12345678901' });
    expect(res.status).toBe(400);
    const { rows } = await pool.query('SELECT 1 FROM users WHERE email = $1', [VALID.email]);
    expect(rows).toHaveLength(0);
  });

  test('rejects a duplicate email without creating a second account', async () => {
    await request(app).post('/api/register').send(VALID);
    const res = await request(app).post('/api/register').send(VALID);
    expect(res.status).toBe(409);
    const { rows } = await pool.query('SELECT count(*)::int AS c FROM users WHERE email = $1', [VALID.email]);
    expect(rows[0].c).toBe(1);
  });

  test('stores only a salted hash, never the plaintext password', async () => {
    await request(app).post('/api/register').send(VALID);
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', [VALID.email]);
    expect(rows[0].password_hash).not.toBe(VALID.password);
    expect(rows[0].password_hash.startsWith('$2')).toBe(true); // bcrypt prefix
  });
});

describe('login (FR-02)', () => {
  test('returns a generic error for both a missing account and a wrong password', async () => {
    const missing = await request(app)
      .post('/api/sessions')
      .send({ email: 'nobody@example.com', password: 'whatever12345' });
    await request(app).post('/api/register').send({ ...VALID, email: 'real@example.com' });
    const wrong = await request(app)
      .post('/api/sessions')
      .send({ email: 'real@example.com', password: 'wrongpassword123' });

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(missing.body.message).toBe(wrong.body.message);
  });

  test('issues a session token on valid credentials', async () => {
    await request(app).post('/api/register').send(VALID);
    const res = await request(app).post('/api/sessions').send({ email: VALID.email, password: VALID.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.role).toBe('passenger');
  });

  test('records successful and failed sign-ins without recording passwords (FR-09, SEC-04)', async () => {
    await request(app).post('/api/register').send(VALID);
    await request(app).post('/api/sessions').send({ email: VALID.email, password: VALID.password });
    await request(app).post('/api/sessions').send({ email: VALID.email, password: 'wrongpassword123' });

    const { rows } = await pool.query(
      "SELECT action, outcome FROM audit_events WHERE action = 'login' ORDER BY id"
    );
    expect(rows).toEqual([
      { action: 'login', outcome: 'success' },
      { action: 'login', outcome: 'failure' },
    ]);
    const { rows: logs } = await pool.query('SELECT * FROM audit_events');
    expect(JSON.stringify(logs)).not.toContain(VALID.password);
    expect(JSON.stringify(logs)).not.toContain('wrongpassword123');
  });
});

describe('lockout (SEC-04)', () => {
  test('rejects the sixth attempt for 15 minutes and audits the rejection', async () => {
    await request(app).post('/api/register').send(VALID);

    for (let attempt = 1; attempt <= 5; attempt++) {
      const res = await request(app)
        .post('/api/sessions')
        .send({ email: VALID.email, password: 'wrongpassword123' });
      expect(res.status).toBe(401);
    }

    const blocked = await request(app)
      .post('/api/sessions')
      .send({ email: VALID.email, password: VALID.password });
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('ACCOUNT_LOCKED');

    const { rows } = await pool.query(
      "SELECT count(*)::int AS c FROM audit_events WHERE action = 'login' AND outcome = 'locked'"
    );
    expect(rows[0].c).toBe(1);
  });

});
