const request = require('supertest');
const createApp = require('../src/app');
const { pool, resetDb, seedTrip, seedUser } = require('./testDb');

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe('availability (FR-04)', () => {
  test('a trip with N seats reports N unreserved seats', async () => {
    const tripId = await seedTrip({ capacity: 3 });
    const res = await request(app).get(`/api/trips/${tripId}/availability`);
    expect(res.status).toBe(200);
    expect(res.body.unreserved).toBe(3);
    expect(res.body.capacity).toBe(3);
  });

  test('a sold-out trip reports zero and never a negative count', async () => {
    const tripId = await seedTrip({ capacity: 1 });
    const token = await seedUser({ role: 'passenger' });
    await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'sold-out-1')
      .send({ tripId });

    const res = await request(app).get(`/api/trips/${tripId}/availability`);
    expect(res.status).toBe(200);
    expect(res.body.unreserved).toBe(0);
    expect(res.body.unreserved).toBeGreaterThanOrEqual(0);
    expect(res.body.unreserved).toBeLessThanOrEqual(res.body.capacity);
  });

  test('unknown and disabled trips are rejected', async () => {
    const missing = await request(app).get('/api/trips/999999/availability');
    expect(missing.status).toBe(404);

    const tripId = await seedTrip({ capacity: 2 });
    await pool.query('UPDATE trips SET enabled = false WHERE id = $1', [tripId]);
    const res = await request(app).get(`/api/trips/${tripId}/availability`);
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
  });
});
