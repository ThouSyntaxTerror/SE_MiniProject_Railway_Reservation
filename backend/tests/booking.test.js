const request = require('supertest');
const createApp = require('../src/app');
const { pool, resetDb, seedTrip, seedUser } = require('./testDb');
const paymentSimulator = require('../src/paymentSimulator');

const app = createApp();

beforeEach(async () => {
  await resetDb();
  paymentSimulator.setForceFailure(false);
  paymentSimulator.setForceRefundFailure(false);
});

afterAll(async () => {
  await pool.end();
});

describe('booking (FR-05, FR-06)', () => {
  test('a retried Idempotency-Key returns the original booking, not a second one', async () => {
    const tripId = await seedTrip({ capacity: 2 });
    const token = await seedUser();

    const first = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'key-1')
      .send({ tripId });
    const second = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'key-1')
      .send({ tripId });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.pnr).toBe(first.body.pnr);
    const { rows } = await pool.query("SELECT count(*)::int AS c FROM bookings WHERE status = 'confirmed'");
    expect(rows[0].c).toBe(1);
  });

  test('returns 409 once every seat is confirmed', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const tokenA = await seedUser();
    const tokenB = await seedUser();

    const first = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Idempotency-Key', 'a-1')
      .send({ tripId });
    const second = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('Idempotency-Key', 'b-1')
      .send({ tripId });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  test('a failed payment releases the hold and creates no confirmed booking', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const token = await seedUser();
    paymentSimulator.setForceFailure(true);

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'fail-1')
      .send({ tripId });

    expect(res.status).toBe(402);
    const { rows } = await pool.query("SELECT count(*)::int AS c FROM bookings WHERE status = 'confirmed'");
    expect(rows[0].c).toBe(0);
    const availability = await request(app).get(`/api/trips/${tripId}/availability`);
    expect(availability.body.unreserved).toBe(1); // seat was released
  });

  test('a missing trip is 404 and a disabled trip is not bookable', async () => {
    const token = await seedUser();
    const missing = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'missing-1')
      .send({ tripId: 999999 });
    expect(missing.status).toBe(404);

    const tripId = await seedTrip({ capacity: 1 });
    await pool.query('UPDATE trips SET enabled = false WHERE id = $1', [tripId]);
    const disabled = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'disabled-1')
      .send({ tripId });
    expect(disabled.status).toBe(409);
  });

  test('a passenger only sees their own bookings', async () => {
    const tripId = await seedTrip({ capacity: 2 });
    const tokenA = await seedUser();
    const tokenB = await seedUser();
    await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Idempotency-Key', 'owner-1')
      .send({ tripId });

    const ownHistory = await request(app).get('/api/bookings').set('Authorization', `Bearer ${tokenA}`);
    const otherHistory = await request(app).get('/api/bookings').set('Authorization', `Bearer ${tokenB}`);

    expect(ownHistory.body).toHaveLength(1);
    expect(otherHistory.body).toHaveLength(0);
  });
});

describe('cancellation (FR-07, SEC-01)', () => {
  async function book(tripId, token, key = 'cancel-1') {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({ tripId });
    expect(res.status).toBe(201);
    return res.body;
  }

  test('the owner cancels once, gets a refund reference, and the seat is released once', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const token = await seedUser();
    const booking = await book(tripId, token);

    const first = await request(app)
      .post(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('cancelled');
    expect(first.body.refundReference).toMatch(/^REF-/);
    expect(first.body.alreadyCancelled).toBe(false);

    const availability = await request(app).get(`/api/trips/${tripId}/availability`);
    expect(availability.body.unreserved).toBe(1);

    const second = await request(app)
      .post(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(200);
    expect(second.body.alreadyCancelled).toBe(true);
    expect(second.body.refundReference).toBe(first.body.refundReference);

    const { rows } = await pool.query(
      "SELECT count(*)::int AS c FROM payment_events WHERE kind = 'refund'"
    );
    expect(rows[0].c).toBe(1); // exactly one refund, never a second release
  });

  test('a non-owner gets 404 with no booking details (SEC-01)', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const owner = await seedUser();
    const other = await seedUser();
    const booking = await book(tripId, owner);

    const res = await request(app)
      .post(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${other}`);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain(booking.pnr);

    const stillThere = await request(app).get('/api/bookings').set('Authorization', `Bearer ${owner}`);
    expect(stillThere.body[0].status).toBe('confirmed');
  });

  test('cancellation after departure is rejected and the booking stays confirmed', async () => {
    const tripId = await seedTrip({ capacity: 1, daysAhead: -1 });
    const token = await seedUser();
    const booking = await book(tripId, token, 'past-1');

    const res = await request(app)
      .post(`/api/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DEPARTED');
  });

  test('cancellation is written to the audit trail', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const token = await seedUser();
    const booking = await book(tripId, token);
    await request(app).post(`/api/bookings/${booking.id}/cancel`).set('Authorization', `Bearer ${token}`);

    const { rows } = await pool.query(
      "SELECT outcome FROM audit_events WHERE action = 'cancellation'"
    );
    expect(rows).toEqual([{ outcome: 'success' }]);
  });
});
