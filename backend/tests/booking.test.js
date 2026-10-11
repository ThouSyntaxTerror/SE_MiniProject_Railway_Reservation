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

beforeEach(async () => {
  await resetDb();
  paymentSimulator.setForceFailure(false);
});

afterAll(async () => {
  await pool.end();
});

describe('booking (FR-05, FR-06)', () => {
  test('a retried Idempotency-Key returns the original booking, not a second one', async () => {
    const tripId = await seedTrip({ capacity: 2 });
    const token = await registerAndLogin('rider@example.com');

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
    const tokenA = await registerAndLogin('a@example.com');
    const tokenB = await registerAndLogin('b@example.com');

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
    const token = await registerAndLogin('failpay@example.com');
    paymentSimulator.setForceFailure(true);

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'fail-1')
      .send({ tripId });

    expect(res.status).toBe(402);
    const { rows } = await pool.query("SELECT count(*)::int AS c FROM bookings WHERE status = 'confirmed'");
    expect(rows[0].c).toBe(0);
  });

  test('a passenger only sees their own bookings', async () => {
    const tripId = await seedTrip({ capacity: 2 });
    const tokenA = await registerAndLogin('owner@example.com');
    const tokenB = await registerAndLogin('other@example.com');
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
