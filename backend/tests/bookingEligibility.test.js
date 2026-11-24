// SRS UC-01 precondition ("the selected trip is enabled") and FR-05 ("selects an available trip"):
// a booking may only be made on an existing, enabled trip that has not yet departed, and a malformed
// trip id is a client error, not a server error. Found while validating the SRS against the running
// system; before the fix a disabled or already-departed trip could be booked (201).
const request = require('supertest');
const createApp = require('../src/app');
const { pool, resetDb, seedTrip, seedUser } = require('./testDb');

const app = createApp();

const book = (token, tripId, key) =>
  request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', key)
    .send({ tripId });

async function bookingCount() {
  const { rows } = await pool.query('SELECT count(*)::int AS c FROM bookings');
  return rows[0].c;
}

async function auditOutcomes() {
  const { rows } = await pool.query("SELECT outcome FROM audit_events WHERE action = 'booking' ORDER BY id");
  return rows.map((r) => r.outcome);
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe('which trips can be booked (UC-01, FR-05)', () => {
  test('an enabled trip that departs in the future is booked as before', async () => {
    const token = await seedUser();
    const tripId = await seedTrip({ capacity: 1 });

    const res = await book(token, tripId, 'ok');

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('confirmed');
  });

  test('a disabled trip is refused with 409 and nothing is booked', async () => {
    const token = await seedUser();
    const tripId = await seedTrip({ capacity: 2 });
    await pool.query('UPDATE trips SET enabled = false WHERE id = $1', [tripId]);

    const res = await book(token, tripId, 'disabled');

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'TRIP_NOT_BOOKABLE', message: 'This trip is not open for booking.' });
    expect(await bookingCount()).toBe(0);
    expect(await auditOutcomes()).toEqual(['trip_disabled']);
  });

  test('a trip that has already departed is refused with 409 and nothing is booked', async () => {
    const token = await seedUser();
    const tripId = await seedTrip({ capacity: 2, departsIn: '-1 hour' });

    const res = await book(token, tripId, 'departed');

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'TRIP_NOT_BOOKABLE', message: 'This train has already departed.' });
    expect(await bookingCount()).toBe(0);
    expect(await auditOutcomes()).toEqual(['trip_departed']);
  });

  test('a trip that does not exist is 404, not "no seats available"', async () => {
    const token = await seedUser();

    const res = await book(token, 999999, 'missing');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TRIP_NOT_FOUND');
    expect(await auditOutcomes()).toEqual(['trip_not_found']);
  });

  test.each([
    ['text', 'abc'],
    ['a fraction', 1.5],
    ['zero', 0],
    ['negative', -3],
  ])('a trip id that is %s is a 400, never a 500', async (_name, tripId) => {
    const token = await seedUser();

    const res = await book(token, tripId, `bad-${String(tripId)}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(await bookingCount()).toBe(0);
  });

  test('a numeric string id is accepted, as the API always has', async () => {
    const token = await seedUser();
    const tripId = await seedTrip({ capacity: 1 });

    const res = await book(token, String(tripId), 'string-id');

    expect(res.status).toBe(201);
  });

  test('retrying an earlier booking after the trip was disabled still returns the original booking', async () => {
    const token = await seedUser();
    const tripId = await seedTrip({ capacity: 1 });
    const first = await book(token, tripId, 'same-key');
    await pool.query('UPDATE trips SET enabled = false WHERE id = $1', [tripId]);

    const retry = await book(token, tripId, 'same-key');

    expect(retry.status).toBe(201);
    expect(retry.body.id).toBe(first.body.id);
    expect(await bookingCount()).toBe(1);
  });

  test('a trip disabled after a booking was made does not affect that booking', async () => {
    const token = await seedUser();
    const tripId = await seedTrip({ capacity: 2 });
    const first = await book(token, tripId, 'before');
    await pool.query('UPDATE trips SET enabled = false WHERE id = $1', [tripId]);

    const second = await book(token, tripId, 'after');

    expect(second.status).toBe(409);
    const { rows } = await pool.query('SELECT status FROM bookings WHERE id = $1', [first.body.id]);
    expect(rows[0].status).toBe('confirmed');
  });
});
