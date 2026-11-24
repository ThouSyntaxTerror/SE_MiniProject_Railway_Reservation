// Failure-path tests for booking and cancellation (FR-05, FR-07, NFR-03, SEC-01).
//
// The happy paths and the business rules are covered in booking.test.js and cancellation.test.js.
// These tests cover the branches those files cannot reach with real data: input validation at the
// route and service layer, and what happens when the database driver itself fails part-way
// through a transaction. A fake client is injected for the driver failures because a real
// Postgres will not fail on demand.
const request = require('supertest');
const createApp = require('../src/app');
const { pool, resetDb, seedTrip, seedUser } = require('./testDb');
const bookingService = require('../src/services/bookingService');
const auditService = require('../src/services/auditService');

const app = createApp();

// A client whose BEGIN and ROLLBACK succeed (or ROLLBACK fails) and whose first real statement
// throws `err`, so the service's catch block runs exactly as it would on a driver failure.
function failingClient(err, { rollbackFails = false } = {}) {
  return {
    query: jest.fn(async (sql) => {
      if (/^\s*BEGIN/i.test(sql)) return { rows: [] };
      if (/^\s*ROLLBACK/i.test(sql)) {
        if (rollbackFails) throw new Error('connection lost');
        return { rows: [] };
      }
      throw err;
    }),
    release: jest.fn(),
  };
}

function driverError(code, extra = {}) {
  return Object.assign(new Error(`driver error ${code}`), { code, ...extra });
}

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await pool.end();
});

describe('booking input validation (FR-05)', () => {
  test('POST /api/bookings without an Idempotency-Key header is a 400', async () => {
    const token = await seedUser();
    const tripId = await seedTrip({ capacity: 1 });

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    const { rows } = await pool.query('SELECT count(*)::int AS c FROM bookings');
    expect(rows[0].c).toBe(0);
  });

  test('POST /api/bookings without a tripId is a 400 and creates nothing', async () => {
    const token = await seedUser();

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'no-trip')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    const { rows } = await pool.query('SELECT count(*)::int AS c FROM bookings');
    expect(rows[0].c).toBe(0);
  });

  test('the service rejects a missing key even when called directly', async () => {
    await expect(
      bookingService.book({ userId: 1, tripId: 1, idempotencyKey: undefined })
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
  });
});

describe('database failures during booking (NFR-03)', () => {
  test.each([
    ['serialization failure', driverError('40001')],
    ['deadlock detected', driverError('40P01')],
    [
      'unique index on a confirmed seat',
      driverError('23505', { constraint: 'one_confirmed_booking_per_seat' }),
    ],
  ])('%s is reported as 409 SEAT_UNAVAILABLE, never a 500', async (_name, err) => {
    const client = failingClient(err);
    jest.spyOn(pool, 'connect').mockResolvedValueOnce(client);

    await expect(
      bookingService.book({ userId: 1, tripId: 1, idempotencyKey: 'race' })
    ).rejects.toMatchObject({ status: 409, code: 'SEAT_UNAVAILABLE' });

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('a unique violation on some other constraint is not disguised as a seat conflict', async () => {
    const err = driverError('23505', { constraint: 'users_email_key' });
    const client = failingClient(err);
    jest.spyOn(pool, 'connect').mockResolvedValueOnce(client);

    await expect(
      bookingService.book({ userId: 1, tripId: 1, idempotencyKey: 'other' })
    ).rejects.toBe(err);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('an unrelated driver error is rethrown unchanged and the connection is released', async () => {
    const err = driverError('08006');
    const client = failingClient(err);
    jest.spyOn(pool, 'connect').mockResolvedValueOnce(client);

    await expect(
      bookingService.book({ userId: 1, tripId: 1, idempotencyKey: 'down' })
    ).rejects.toBe(err);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('if ROLLBACK also fails, the original error is still the one reported', async () => {
    const client = failingClient(driverError('40001'), { rollbackFails: true });
    jest.spyOn(pool, 'connect').mockResolvedValueOnce(client);

    await expect(
      bookingService.book({ userId: 1, tripId: 1, idempotencyKey: 'rb' })
    ).rejects.toMatchObject({ status: 409, code: 'SEAT_UNAVAILABLE' });
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

describe('database failures during cancellation (FR-07)', () => {
  test.each([
    ['not a number', 'abc'],
    ['zero', '0'],
    ['negative', '-4'],
    ['fractional', '1.5'],
  ])('a booking id that is %s is a 404 and never reaches the database', async (_name, id) => {
    const connect = jest.spyOn(pool, 'connect');

    await expect(
      bookingService.cancel({ userId: 1, bookingId: id })
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(connect).not.toHaveBeenCalled();
  });

  test('an unexpected driver error rolls back, releases the connection and is rethrown', async () => {
    const err = driverError('57P01');
    const client = failingClient(err);
    jest.spyOn(pool, 'connect').mockResolvedValueOnce(client);

    await expect(bookingService.cancel({ userId: 1, bookingId: '5' })).rejects.toBe(err);

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('if ROLLBACK also fails during a cancel, the original error is still reported', async () => {
    const err = driverError('57P01');
    const client = failingClient(err, { rollbackFails: true });
    jest.spyOn(pool, 'connect').mockResolvedValueOnce(client);

    await expect(bookingService.cancel({ userId: 1, bookingId: '5' })).rejects.toBe(err);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

describe('audit events with no actor or request id (FR-09)', () => {
  test('are stored with NULL actor and request id instead of failing', async () => {
    await auditService.record(pool, { action: 'login', outcome: 'unknown_user' });

    const { rows } = await pool.query(
      "SELECT actor_id, request_id, action, outcome FROM audit_events WHERE action = 'login'"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      actor_id: null,
      request_id: null,
      action: 'login',
      outcome: 'unknown_user',
    });
  });
});
