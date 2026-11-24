// Error-path tests that cut across modules: the central error handler (design §3.4), search and
// sign-in input validation (FR-02, FR-03), and the administrator paths that need a database
// failure or a missing record (FR-08).
const express = require('express');
const request = require('supertest');
const createApp = require('../src/app');
const { pool, resetDb, seedUser } = require('./testDb');
const adminService = require('../src/services/adminService');
const { errorHandler, requestId, asyncHandler, AppError } = require('../src/middleware/errors');

const app = createApp();
const future = (days) => new Date(Date.now() + days * 86400000).toISOString();

const TRIP = {
  train_number: 'ERR-1',
  origin: 'Bengaluru',
  destination: 'Chennai',
  departure_utc: future(2),
  arrival_utc: future(2.25),
  fare: 700,
  capacity: 4,
};

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await pool.end();
});

describe('central error handler (design §3.4)', () => {
  // A tiny app that mounts the real handler with two routes that fail in different ways.
  const mini = express();
  mini.use(requestId);
  mini.get('/known', asyncHandler(async () => {
    throw new AppError(418, 'TEAPOT', 'Short and stout.');
  }));
  mini.get('/unknown', asyncHandler(async () => {
    throw new Error('relation "secret_table" does not exist');
  }));
  mini.use(errorHandler);

  test('an AppError surfaces its own status, code and message plus a request id', async () => {
    const res = await request(mini).get('/known');

    expect(res.status).toBe(418);
    expect(res.body).toMatchObject({ code: 'TEAPOT', message: 'Short and stout.' });
    expect(res.body.requestId).toMatch(/^req_/);
  });

  test('any other error becomes a generic 500 that leaks nothing', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(mini).get('/unknown');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(res.body.message).toBe('Unexpected error.');
    expect(JSON.stringify(res.body)).not.toMatch(/secret_table|relation|stack/i);
    expect(log).toHaveBeenCalledTimes(1);
  });
});

describe('search input validation (FR-03)', () => {
  test.each([
    ['no filters at all', ''],
    ['no date', '?origin=Bengaluru&destination=Chennai'],
    ['no destination', '?origin=Bengaluru&date=2026-12-01'],
    ['no origin', '?destination=Chennai&date=2026-12-01'],
  ])('%s is a 400', async (_name, query) => {
    const res = await request(app).get(`/api/trips${query}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('a date that is not a date is a 400', async () => {
    const res = await request(app).get('/api/trips?origin=Bengaluru&destination=Chennai&date=tomorrow-ish');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/ISO 8601/);
  });
});

describe('sign-in input validation (FR-02)', () => {
  test.each([
    ['an empty body', {}],
    ['a missing password', { email: 'someone@example.com' }],
    ['a missing email', { password: 'correctpassword123' }],
  ])('%s gets the same generic 401 as a wrong password', async (_name, body) => {
    const res = await request(app).post('/api/sessions').send(body);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('administrator error paths (FR-08)', () => {
  test('an administrator can list all trips, including disabled ones', async () => {
    const token = await seedUser({ role: 'admin' });
    const created = await request(app).post('/api/admin/trips').set('Authorization', `Bearer ${token}`).send(TRIP);
    await request(app).delete(`/api/admin/trips/${created.body.id}`).set('Authorization', `Bearer ${token}`);

    const res = await request(app).get('/api/admin/trips').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: created.body.id, enabled: false });
  });

  test.each([
    'train_number',
    'origin',
    'destination',
    'departure_utc',
    'arrival_utc',
    'fare',
    'capacity',
  ])('creating a trip without %s is a 400 and stores nothing', async (field) => {
    const token = await seedUser({ role: 'admin' });
    const body = { ...TRIP };
    delete body[field];

    const res = await request(app).post('/api/admin/trips').set('Authorization', `Bearer ${token}`).send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain(field);
    const { rows } = await pool.query('SELECT count(*)::int AS c FROM trips');
    expect(rows[0].c).toBe(0);
  });

  test('disabling a trip that does not exist is a 404 and writes no audit event', async () => {
    const token = await seedUser({ role: 'admin' });

    const res = await request(app).delete('/api/admin/trips/99999').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TRIP_NOT_FOUND');
    const { rows } = await pool.query("SELECT count(*)::int AS c FROM audit_events WHERE action = 'admin_trip_disable'");
    expect(rows[0].c).toBe(0);
  });

  test('a database failure while creating a trip rolls back and releases the connection', async () => {
    const err = Object.assign(new Error('disk full'), { code: '53100' });
    const client = {
      query: jest.fn(async (sql) => {
        if (/^\s*(BEGIN|ROLLBACK)/i.test(sql)) return { rows: [] };
        throw err;
      }),
      release: jest.fn(),
    };
    jest.spyOn(pool, 'connect').mockResolvedValueOnce(client);

    await expect(
      adminService.createTrip(TRIP, { actorId: 1, requestId: 'req_test' })
    ).rejects.toBe(err);

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('a failed ROLLBACK does not hide the original error', async () => {
    const err = Object.assign(new Error('disk full'), { code: '53100' });
    const client = {
      query: jest.fn(async (sql) => {
        if (/^\s*BEGIN/i.test(sql)) return { rows: [] };
        if (/^\s*ROLLBACK/i.test(sql)) throw new Error('connection lost');
        throw err;
      }),
      release: jest.fn(),
    };
    jest.spyOn(pool, 'connect').mockResolvedValueOnce(client);

    await expect(
      adminService.createTrip(TRIP, { actorId: 1, requestId: 'req_test' })
    ).rejects.toBe(err);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
