// FR-07 / FR-06: a cancellation leaves a permanent record on the booking itself (when it was
// cancelled and the refund reference), and the passenger's history returns it, so the reference is
// still there after the confirmation banner is gone. Before this, both columns existed in the schema
// but nothing ever wrote them.
const request = require('supertest');
const createApp = require('../src/app');
const { pool, resetDb, seedTrip } = require('./testDb');
const paymentSimulator = require('../src/paymentSimulator');

const app = createApp();

async function registerAndLogin(email) {
  const payload = { name: 'Record Tester', email, password: 'correctpassword123' };
  await request(app).post('/api/register').send(payload);
  const res = await request(app).post('/api/sessions').send(payload);
  return res.body.token;
}

async function book(token, tripId, key) {
  const res = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', key)
    .send({ tripId });
  return res.body;
}

const cancel = (token, id) =>
  request(app).post(`/api/bookings/${id}/cancel`).set('Authorization', `Bearer ${token}`);
const history = (token) =>
  request(app).get('/api/bookings').set('Authorization', `Bearer ${token}`);

beforeEach(async () => {
  await resetDb();
  paymentSimulator.setForceFailure(false);
  paymentSimulator.setForceRefundFailure(false);
});

afterAll(async () => {
  await pool.end();
});

describe('cancellation record on the booking (FR-07)', () => {
  test('a cancelled booking stores when it was cancelled and the refund reference', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const token = await registerAndLogin('rec1@example.com');
    const booking = await book(token, tripId, 'k1');

    const res = await cancel(token, booking.id);

    const { rows } = await pool.query(
      'SELECT status, cancelled_utc, refund_reference FROM bookings WHERE id = $1',
      [booking.id]
    );
    expect(rows[0].status).toBe('cancelled');
    expect(rows[0].refund_reference).toBe(`RFND-${booking.pnr}`);
    expect(rows[0].refund_reference).toBe(res.body.refundReference);
    expect(Math.abs(Date.now() - new Date(rows[0].cancelled_utc).getTime())).toBeLessThan(60 * 1000);
  });

  test('the passenger history returns the cancellation time and refund reference', async () => {
    const tripId = await seedTrip({ capacity: 2 });
    const token = await registerAndLogin('rec2@example.com');
    const kept = await book(token, tripId, 'keep');
    const dropped = await book(token, tripId, 'drop');
    await cancel(token, dropped.id);

    const res = await history(token);

    const byPnr = Object.fromEntries(res.body.map((b) => [b.pnr, b]));
    expect(byPnr[dropped.pnr]).toMatchObject({ status: 'cancelled', refund_reference: `RFND-${dropped.pnr}` });
    expect(byPnr[dropped.pnr].cancelled_utc).toBeTruthy();
    expect(byPnr[kept.pnr]).toMatchObject({ status: 'confirmed', refund_reference: null, cancelled_utc: null });
  });

  test('a failed refund still cancels the booking but stores no refund reference', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const token = await registerAndLogin('rec3@example.com');
    const booking = await book(token, tripId, 'k3');
    paymentSimulator.setForceRefundFailure(true);

    const res = await cancel(token, booking.id);

    expect(res.status).toBe(200);
    expect(res.body.refundStatus).toBe('failed');
    const { rows } = await pool.query(
      'SELECT status, cancelled_utc, refund_reference FROM bookings WHERE id = $1',
      [booking.id]
    );
    expect(rows[0].status).toBe('cancelled');
    expect(rows[0].cancelled_utc).not.toBeNull();
    expect(rows[0].refund_reference).toBeNull();
    const events = await pool.query(
      "SELECT status FROM payment_events WHERE booking_id = $1 AND kind = 'refund'",
      [booking.id]
    );
    expect(events.rows).toEqual([{ status: 'failed' }]); // the attempt is still recorded
  });

  test('a rejected cancellation leaves the record untouched', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const owner = await registerAndLogin('rec4a@example.com');
    const stranger = await registerAndLogin('rec4b@example.com');
    const booking = await book(owner, tripId, 'k4');

    await cancel(stranger, booking.id); // not the owner: 404
    const { rows } = await pool.query(
      'SELECT status, cancelled_utc, refund_reference FROM bookings WHERE id = $1',
      [booking.id]
    );
    expect(rows[0]).toEqual({ status: 'confirmed', cancelled_utc: null, refund_reference: null });

    await cancel(owner, booking.id);
    const first = (await pool.query('SELECT cancelled_utc FROM bookings WHERE id = $1', [booking.id])).rows[0];
    await cancel(owner, booking.id); // repeat: 409, must not overwrite the first timestamp
    const second = (await pool.query('SELECT cancelled_utc FROM bookings WHERE id = $1', [booking.id])).rows[0];
    expect(new Date(second.cancelled_utc).getTime()).toBe(new Date(first.cancelled_utc).getTime());
  });

  test('a passenger never sees another passenger\'s refund reference', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const owner = await registerAndLogin('rec5a@example.com');
    const other = await registerAndLogin('rec5b@example.com');
    const booking = await book(owner, tripId, 'k5');
    await cancel(owner, booking.id);

    const res = await history(other);

    expect(res.body).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain('RFND-');
  });
});
