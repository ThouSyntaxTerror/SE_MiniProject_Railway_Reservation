const request = require('supertest');
const createApp = require('../src/app');
const { pool, resetDb, seedTrip } = require('./testDb');

const app = createApp();
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe('train search (FR-03)', () => {
  test('returns only matching trips, ordered by departure time', async () => {
    await seedTrip({ capacity: 2, origin: 'Bengaluru', destination: 'Chennai', daysAhead: 2 });
    await seedTrip({ capacity: 2, origin: 'Bengaluru', destination: 'Chennai', daysAhead: 1 });
    await seedTrip({ capacity: 2, origin: 'Chennai', destination: 'Bengaluru', daysAhead: 1 });

    const res = await request(app)
      .get('/api/trips')
      .query({ origin: 'Bengaluru', destination: 'Chennai', date: tomorrow() });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const departures = res.body.map((t) => new Date(t.departure_utc).getTime());
    expect(departures).toEqual([...departures].sort((a, b) => a - b));
    expect(res.body.every((t) => t.origin === 'Bengaluru' && t.destination === 'Chennai')).toBe(true);
  });

  test('includes trips departing on or after the requested date (SRS wording)', async () => {
    await seedTrip({ capacity: 2, daysAhead: 5 });
    const res = await request(app)
      .get('/api/trips')
      .query({ origin: 'Bengaluru', destination: 'Chennai', date: inDays(1) });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test('is case-insensitive and ignores disabled trips', async () => {
    const tripId = await seedTrip({ capacity: 2 });
    await pool.query('UPDATE trips SET enabled = false WHERE id = $1', [tripId]);

    const res = await request(app)
      .get('/api/trips')
      .query({ origin: 'bengaluru', destination: 'CHENNAI', date: tomorrow() });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  test('rejects a missing filter with 400', async () => {
    const res = await request(app).get('/api/trips').query({ origin: 'Bengaluru', destination: 'Chennai' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
