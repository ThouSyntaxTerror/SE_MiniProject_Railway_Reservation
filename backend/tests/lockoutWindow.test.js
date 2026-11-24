// SEC-04: "After five failed sign-in attempts for one account within 15 minutes, further attempts
// shall be rejected for 15 minutes and logged without the submitted password."
//
// auth.test.js covers the basic five-then-locked case. These tests cover the two time rules around
// it, which need the clock moved: failures only count while they fall in one 15-minute window, and
// the lock ends after 15 minutes. Moving the clock is done by back-dating the stored timestamps,
// which is exactly the state the system would be in after that much time had passed.
const request = require('supertest');
const createApp = require('../src/app');
const { pool, resetDb } = require('./testDb');
const authService = require('../src/services/authService');

const app = createApp();
const USER = { name: 'Lock Tester', email: 'lock@example.com', password: 'correctpassword123' };

const wrong = () =>
  request(app).post('/api/sessions').send({ email: USER.email, password: 'wrongpassword123' });
const right = () =>
  request(app).post('/api/sessions').send({ email: USER.email, password: USER.password });

async function state() {
  const { rows } = await pool.query(
    `SELECT failed_attempts, failed_window_start, locked_until,
            (locked_until > now()) AS is_locked
     FROM users WHERE email = $1`,
    [USER.email]
  );
  return rows[0];
}

// Pretend `minutes` have passed since the current failure window opened.
async function ageWindow(minutes) {
  await pool.query(
    `UPDATE users SET failed_window_start = failed_window_start - ($2 || ' minutes')::interval
     WHERE email = $1`,
    [USER.email, String(minutes)]
  );
}

beforeEach(async () => {
  await resetDb();
  await request(app).post('/api/register').send(USER);
});

afterAll(async () => {
  await pool.end();
});

describe('failure window (SEC-04)', () => {
  test('five failures inside one window lock the account and the fifth is the one that locks', async () => {
    for (let i = 1; i <= 4; i++) {
      expect((await wrong()).status).toBe(401);
    }
    expect((await state()).failed_attempts).toBe(4);
    expect((await state()).is_locked).toBeFalsy();

    expect((await wrong()).status).toBe(401); // the fifth failure is still a 401 ...
    expect((await state()).is_locked).toBe(true); // ... but it set the lock
    expect((await right()).status).toBe(429);

    const { rows } = await pool.query(
      "SELECT count(*)::int AS c FROM audit_events WHERE action = 'account_lockout' AND outcome = 'locked'"
    );
    expect(rows[0].c).toBe(1);
  });

  test('failures older than 15 minutes no longer count toward the lock', async () => {
    for (let i = 1; i <= 4; i++) await wrong();
    await ageWindow(16); // the first four are now outside the window

    expect((await wrong()).status).toBe(401); // a fifth failure overall, but only the first in its window
    const s = await state();
    expect(s.failed_attempts).toBe(1);
    expect(s.is_locked).toBeFalsy();
    expect((await right()).status).toBe(200);
  });

  test('failures spread over several windows never lock the account', async () => {
    for (let window = 1; window <= 3; window++) {
      for (let i = 1; i <= 3; i++) {
        expect((await wrong()).status).toBe(401);
      }
      await ageWindow(16);
    }
    // nine failures in total, never more than three in one window
    expect((await state()).is_locked).toBeFalsy();
    expect((await right()).status).toBe(200);
  });

  test('failures just inside the window still count', async () => {
    for (let i = 1; i <= 4; i++) await wrong();
    await ageWindow(14); // 14 minutes later: the window is still open

    await wrong();
    expect((await state()).is_locked).toBe(true);
  });

  test('a successful sign-in clears the count, so earlier failures do not carry over', async () => {
    for (let i = 1; i <= 4; i++) await wrong();
    expect((await right()).status).toBe(200);
    expect(await state()).toMatchObject({ failed_attempts: 0, failed_window_start: null });

    for (let i = 1; i <= 4; i++) await wrong();
    expect((await state()).is_locked).toBeFalsy(); // four new failures, not eight
  });
});

describe('lock duration (SEC-04)', () => {
  async function lockAccount() {
    for (let i = 1; i <= 5; i++) await wrong();
    expect((await state()).is_locked).toBe(true);
  }

  test('while locked, even the correct password is refused with 429', async () => {
    await lockAccount();
    const res = await right();
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('ACCOUNT_LOCKED');
  });

  test('the lock lasts 15 minutes from the fifth failure', async () => {
    await lockAccount();
    const { rows } = await pool.query(
      `SELECT extract(epoch FROM (locked_until - now())) AS seconds_left FROM users WHERE email = $1`,
      [USER.email]
    );
    expect(Number(rows[0].seconds_left)).toBeGreaterThan(14 * 60 + 50);
    expect(Number(rows[0].seconds_left)).toBeLessThanOrEqual(15 * 60);
  });

  test('once the lock has expired the correct password signs in and the state is clean', async () => {
    await lockAccount();
    await pool.query("UPDATE users SET locked_until = now() - interval '1 second' WHERE email = $1", [USER.email]);

    const res = await right();

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(await state()).toMatchObject({ failed_attempts: 0, failed_window_start: null, locked_until: null });
  });

  test('after the lock expires a wrong password starts a fresh count of one', async () => {
    await lockAccount();
    await pool.query("UPDATE users SET locked_until = now() - interval '1 second' WHERE email = $1", [USER.email]);

    expect((await wrong()).status).toBe(401);
    const s = await state();
    expect(s.failed_attempts).toBe(1);
    expect(s.is_locked).toBeFalsy();
  });

  test('guesses made while locked do not extend the lock or the count', async () => {
    await lockAccount();
    const before = await state();
    for (let i = 1; i <= 3; i++) expect((await wrong()).status).toBe(429);
    const after = await state();
    expect(after.failed_attempts).toBe(0);
    expect(new Date(after.locked_until).getTime()).toBe(new Date(before.locked_until).getTime());
  });
});

describe('simultaneous guesses (SEC-04)', () => {
  test('eight parallel wrong passwords lock the account exactly once', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => wrong()));

    expect(results.every((r) => r.status === 401 || r.status === 429)).toBe(true);
    const s = await state();
    expect(s.is_locked).toBe(true);
    expect(s.failed_attempts).toBe(0);
    const { rows } = await pool.query(
      "SELECT count(*)::int AS c FROM audit_events WHERE action = 'account_lockout'"
    );
    expect(rows[0].c).toBe(1);
    expect((await right()).status).toBe(429);
  });
});

describe('audit without the password (SEC-04)', () => {
  test('lockout rows never contain the submitted password', async () => {
    for (let i = 1; i <= 5; i++) await wrong();
    await right();

    const { rows } = await pool.query('SELECT * FROM audit_events');
    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(JSON.stringify(rows)).not.toMatch(/wrongpassword123|correctpassword123/);
  });
});

describe('recordFailedAttempt edge cases (SEC-04)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('an unknown user id is ignored without error', async () => {
    await expect(authService.recordFailedAttempt(999999)).resolves.toEqual({ locked: false });
  });

  test('a guess that arrives after the lock was set changes nothing', async () => {
    for (let i = 1; i <= 5; i++) await wrong();
    const before = await state();
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [USER.email]);

    // The sign-in pre-check would have answered 429; this is the case where the request passed the
    // pre-check just before the lock was committed and reaches the counter afterwards.
    await expect(authService.recordFailedAttempt(rows[0].id)).resolves.toEqual({ locked: false });

    const after = await state();
    expect(after.failed_attempts).toBe(0);
    expect(new Date(after.locked_until).getTime()).toBe(new Date(before.locked_until).getTime());
  });

  test('a database failure rolls back, releases the connection and is rethrown', async () => {
    const err = Object.assign(new Error('connection reset'), { code: '08006' });
    const client = {
      query: jest.fn(async (sql) => {
        if (/^\s*(BEGIN|ROLLBACK)/i.test(sql)) return { rows: [] };
        throw err;
      }),
      release: jest.fn(),
    };
    jest.spyOn(pool, 'connect').mockResolvedValueOnce(client);

    await expect(authService.recordFailedAttempt(1)).rejects.toBe(err);

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('a failed ROLLBACK does not hide the original error', async () => {
    const err = Object.assign(new Error('connection reset'), { code: '08006' });
    const client = {
      query: jest.fn(async (sql) => {
        if (/^\s*BEGIN/i.test(sql)) return { rows: [] };
        if (/^\s*ROLLBACK/i.test(sql)) throw new Error('already closed');
        throw err;
      }),
      release: jest.fn(),
    };
    jest.spyOn(pool, 'connect').mockResolvedValueOnce(client);

    await expect(authService.recordFailedAttempt(1)).rejects.toBe(err);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
