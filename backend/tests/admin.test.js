const request = require('supertest');
const createApp = require('../src/app');
const { pool, resetDb, seedUser } = require('./testDb');

const app = createApp();
const future = (days) => new Date(Date.now() + days * 86400000).toISOString();

const TRIP = {
  train_number: 'ADM-1',
  origin: 'Bengaluru',
  destination: 'Chennai',
  departure_utc: future(2),
  arrival_utc: future(2.25),
  fare: 700,
  capacity: 10,
};

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe('administration (FR-08, SEC-01)', () => {
  test('a passenger gets 403 on every administrator route', async () => {
    const token = await seedUser({ role: 'passenger' });
    const create = await request(app)
      .post('/api/admin/trips')
      .set('Authorization', `Bearer ${token}`)
      .send(TRIP);
    const audit = await request(app).get('/api/admin/audit').set('Authorization', `Bearer ${token}`);
    expect(create.status).toBe(403);
    expect(audit.status).toBe(403);
  });

  test('an unauthenticated request gets 401', async () => {
    const res = await request(app).post('/api/admin/trips').send(TRIP);
    expect(res.status).toBe(401);
  });

  test('an administrator creates, edits and disables a trip', async () => {
    const token = await seedUser({ role: 'admin' });

    const created = await request(app)
      .post('/api/admin/trips')
      .set('Authorization', `Bearer ${token}`)
      .send(TRIP);
    expect(created.status).toBe(201);
    expect(created.body.capacity).toBe(10);
    const tripId = created.body.id;

    const availability = await request(app).get(`/api/trips/${tripId}/availability`);
    expect(availability.body.unreserved).toBe(10);

    const patched = await request(app)
      .patch(`/api/admin/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fare: 750, capacity: 12 });
    expect(patched.status).toBe(200);
    expect(patched.body.fare).toBe('750.00');
    expect(patched.body.capacity).toBe(12);

    const disabled = await request(app)
      .delete(`/api/admin/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(disabled.status).toBe(204);

    const search = await request(app)
      .get('/api/trips')
      .query({ origin: TRIP.origin, destination: TRIP.destination, date: TRIP.departure_utc.slice(0, 10) });
    expect(search.body.some((trip) => trip.id === tripId)).toBe(false);
  });

  test('a capacity below a confirmed seat is rejected', async () => {
    const admin = await seedUser({ role: 'admin' });
    const passenger = await seedUser();

    const created = await request(app)
      .post('/api/admin/trips')
      .set('Authorization', `Bearer ${admin}`)
      .send({ ...TRIP, capacity: 2 });
    const tripId = created.body.id;

    // Fill the last seat (seat 2) so shrinking below it would strand a booking.
    await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${passenger}`)
      .set('Idempotency-Key', 'adm-1')
      .send({ tripId });
    await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${passenger}`)
      .set('Idempotency-Key', 'adm-2')
      .send({ tripId });

    const res = await request(app)
      .patch(`/api/admin/trips/${tripId}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ capacity: 1 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CAPACITY_IN_USE');
  });

  test('administrator changes appear in the audit trail (FR-09)', async () => {
    const token = await seedUser({ role: 'admin', email: 'admin@example.com' });
    await request(app).post('/api/admin/trips').set('Authorization', `Bearer ${token}`).send(TRIP);

    const res = await request(app).get('/api/admin/audit').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const action = res.body.find((event) => event.action === 'admin_trip_create');
    expect(action).toBeTruthy();
    expect(action.actor_email).toBe('admin@example.com');
    expect(action.outcome).toBe('success');
    expect(action.created_utc).toBeTruthy();
  });
});

describe('concurrent final seat (NFR-03)', () => {
  test('20 simultaneous bookings for one seat confirm at most one', async () => {
    const admin = await seedUser({ role: 'admin' });
    const created = await request(app)
      .post('/api/admin/trips')
      .set('Authorization', `Bearer ${admin}`)
      .send({ ...TRIP, train_number: 'RACE-1', capacity: 1 });
    const tripId = created.body.id;

    const tokens = await Promise.all(Array.from({ length: 20 }, () => seedUser()));

    const responses = await Promise.all(
      tokens.map((token, index) =>
        request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', `race-${index}`)
          .send({ tripId })
      )
    );

    const confirmed = responses.filter((r) => r.status === 201);
    const rejected = responses.filter((r) => r.status === 409);
    expect(confirmed).toHaveLength(1);
    expect(rejected).toHaveLength(19);

    const availability = await request(app).get(`/api/trips/${tripId}/availability`);
    expect(availability.body.unreserved).toBe(0);
  });
});
