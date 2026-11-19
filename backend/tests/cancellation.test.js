const request = require('supertest');
const createApp = require('../src/app');
const { pool, resetDb, seedTrip } = require('./testDb');
const paymentSimulator = require('../src/paymentSimulator');

const app = createApp();

async function registerAndLogin(email) {
  const payload = { email, password: 'correctpassword123' };
  await request(app).post('/api/register').send(payload);
  const res = await request(app).post('/api/sessions').send(payload);
  return res.body.token;
}

async function bookSeat(token, tripId, key) {
  const res = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', key)
    .send({ tripId });
  return res.body;
}

const cancel = (token, id) =>
  request(app).post(`/api/bookings/${id}/cancel`).set('Authorization', `Bearer ${token}`);

beforeEach(async () => {
  await resetDb();
  paymentSimulator.setForceFailure(false);
  paymentSimulator.setForceRefundFailure(false);
});

afterAll(async () => {
  await pool.end();
});

describe('cancellation (FR-07, SEC-01)', () => {
  test('owner cancels a confirmed booking before departure and gets a refund reference', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const token = await registerAndLogin('owner@example.com');
    const booking = await bookSeat(token, tripId, 'k1');

    const res = await cancel(token, booking.id);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    expect(res.body.refundStatus).toBe('success');
    expect(res.body.refundReference).toBeTruthy();
    const { rows } = await pool.query('SELECT status FROM bookings WHERE id = $1', [booking.id]);
    expect(rows[0].status).toBe('cancelled');
    const refunds = await pool.query(
      "SELECT reference FROM payment_events WHERE kind = 'refund' AND booking_id = $1",
      [booking.id]
    );
    expect(refunds.rows).toHaveLength(1);
    expect(refunds.rows[0].reference).toBe(res.body.refundReference);
  });

  test('cancelling releases the seat so it can be booked again', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const tokenA = await registerAndLogin('a@example.com');
    const tokenB = await registerAndLogin('b@example.com');
    const booking = await bookSeat(tokenA, tripId, 'a-1');
    await cancel(tokenA, booking.id);

    const rebook = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('Idempotency-Key', 'b-1')
      .send({ tripId });

    expect(rebook.status).toBe(201);
  });

  test('a repeated cancellation is rejected with 409 and does not refund twice', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const token = await registerAndLogin('repeat@example.com');
    const booking = await bookSeat(token, tripId, 'r-1');

    const first = await cancel(token, booking.id);
    const second = await cancel(token, booking.id);

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('ALREADY_CANCELLED');
    const refunds = await pool.query("SELECT count(*)::int AS c FROM payment_events WHERE kind = 'refund'");
    expect(refunds.rows[0].c).toBe(1);
  });

  test('a late cancellation (after departure) is rejected with 409 and the booking stays confirmed', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const token = await registerAndLogin('late@example.com');
    const booking = await bookSeat(token, tripId, 'l-1');
    await pool.query("UPDATE trips SET departure_utc = now() - interval '1 hour' WHERE id = $1", [tripId]);

    const res = await cancel(token, booking.id);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CANCELLATION_TOO_LATE');
    const { rows } = await pool.query('SELECT status FROM bookings WHERE id = $1', [booking.id]);
    expect(rows[0].status).toBe('confirmed');
  });

  test('a non-owner cannot cancel another passenger booking', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const owner = await registerAndLogin('owner2@example.com');
    const intruder = await registerAndLogin('intruder@example.com');
    const booking = await bookSeat(owner, tripId, 'o-1');

    const res = await cancel(intruder, booking.id);

    expect(res.status).toBe(404);
    const { rows } = await pool.query('SELECT status FROM bookings WHERE id = $1', [booking.id]);
    expect(rows[0].status).toBe('confirmed');
  });

  test('unknown or malformed booking ids return 404 and unauthenticated calls return 401', async () => {
    const token = await registerAndLogin('misc@example.com');

    expect((await cancel(token, 9999)).status).toBe(404);
    expect((await cancel(token, 'abc')).status).toBe(404);
    expect((await request(app).post('/api/bookings/1/cancel')).status).toBe(401);
  });

  test('a failed refund is recorded but the booking stays cancelled', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const token = await registerAndLogin('refundfail@example.com');
    const booking = await bookSeat(token, tripId, 'f-1');
    paymentSimulator.setForceRefundFailure(true);

    const res = await cancel(token, booking.id);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    expect(res.body.refundStatus).toBe('failed');
    const { rows } = await pool.query("SELECT status FROM payment_events WHERE kind = 'refund'");
    expect(rows[0].status).toBe('failed');

    // The booking stays cancelled despite the refund failure (design doc: refund failure never
    // restores the booking)...
    const stored = await pool.query('SELECT status FROM bookings WHERE id = $1', [booking.id]);
    expect(stored.rows[0].status).toBe('cancelled');
    // ...and, per policy, the seat is released: it is not confirmed and can be booked again.
    const confirmed = await pool.query("SELECT count(*)::int AS c FROM bookings WHERE status = 'confirmed'");
    expect(confirmed.rows[0].c).toBe(0);
    const other = await registerAndLogin('afterfail@example.com');
    const rebook = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${other}`)
      .set('Idempotency-Key', 'af-1')
      .send({ tripId });
    expect(rebook.status).toBe(201);
  });

  test('two concurrent cancellations: exactly one succeeds, one refund, the other is already-cancelled', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const token = await registerAndLogin('race@example.com');
    const booking = await bookSeat(token, tripId, 'race-1');

    const [a, b] = await Promise.all([cancel(token, booking.id), cancel(token, booking.id)]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.code).toBe('ALREADY_CANCELLED');
    const refunds = await pool.query(
      "SELECT count(*)::int AS c FROM payment_events WHERE kind = 'refund' AND booking_id = $1",
      [booking.id]
    );
    expect(refunds.rows[0].c).toBe(1);
    const stored = await pool.query('SELECT status FROM bookings WHERE id = $1', [booking.id]);
    expect(stored.rows[0].status).toBe('cancelled');
  });

  test('every cancellation outcome is audited', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const token = await registerAndLogin('audit@example.com');
    const booking = await bookSeat(token, tripId, 'au-1');
    await cancel(token, booking.id);
    await cancel(token, booking.id);

    const { rows } = await pool.query("SELECT outcome FROM audit_events WHERE action = 'cancellation' ORDER BY id");
    expect(rows.map((r) => r.outcome)).toEqual(['cancelled', 'already_cancelled']);
  });
});
