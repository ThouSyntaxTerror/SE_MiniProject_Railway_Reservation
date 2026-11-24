// Strict id validation (review of PR #44). Trip and booking ids are PostgreSQL INTEGER (SERIAL)
// columns. `Number(value)` let `true`, `[1]`, "1e0", " 1" and "0x1" through as id 1, and ids above
// 2,147,483,647 reached the database and failed there as a 500. These tests pin the rule in
// `src/ids.js` and check every endpoint that takes an id: a bad id in a request body is a 400, a bad
// id in a URL is the same 404 as an unknown id, and nothing reaches the database or changes data.
const request = require('supertest');
const createApp = require('../src/app');
const { pool, resetDb, seedTrip, seedUser } = require('./testDb');
const { parseId, MAX_ID } = require('../src/ids');

const app = createApp();

describe('parseId', () => {
  test.each([
    [1, 1],
    ['1', 1],
    [42, 42],
    ['42', 42],
    [1.0, 1],
    [MAX_ID, 2147483647],
    [String(MAX_ID), 2147483647],
  ])('accepts %j as %d', (input, expected) => {
    expect(parseId(input)).toBe(expected);
  });

  test.each([
    ['true', true],
    ['false', false],
    ['an array', [1]],
    ['an object', { id: 1 }],
    ['null', null],
    ['undefined', undefined],
    ['zero', 0],
    ['"0"', '0'],
    ['a negative number', -1],
    ['"-1"', '-1'],
    ['"+1"', '+1'],
    ['a fraction', 1.5],
    ['"1.5"', '1.5'],
    ['"1.0"', '1.0'],
    ['an exponent string', '1e0'],
    ['a hex string', '0x1'],
    ['a leading zero', '01'],
    ['a leading space', ' 1'],
    ['a trailing space', '1 '],
    ['an empty string', ''],
    ['text', 'abc'],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['one above the INTEGER limit', MAX_ID + 1],
    ['one above the limit as text', String(MAX_ID + 1)],
    ['a huge number', 1e20],
    ['an unsafe integer', Number.MAX_SAFE_INTEGER + 2],
    ['eleven digits', '99999999999'],
  ])('rejects %s', (_name, input) => {
    expect(parseId(input)).toBeNull();
  });
});

describe('ids at the API', () => {
  let token;
  let adminToken;
  let tripId;

  beforeEach(async () => {
    await resetDb();
    token = await seedUser();
    adminToken = await seedUser({ role: 'admin' });
    tripId = await seedTrip({ capacity: 3 }); // id 1, the value the loose parsing used to produce
  });

  afterAll(async () => {
    await pool.end();
  });

  const book = (value, key) =>
    request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({ tripId: value });

  test.each([
    ['true', true],
    ['an array', [1]],
    ['an exponent string', '1e0'],
    ['a padded string', ' 1'],
    ['a hex string', '0x1'],
    ['an id above the INTEGER limit', 2147483648],
    ['a huge number', 1e20],
    ['eleven digits', '99999999999'],
  ])('booking with tripId = %s is a 400 and books nothing', async (name, value) => {
    expect(tripId).toBe(1);

    const res = await book(value, `bad-${name}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    const { rows } = await pool.query('SELECT count(*)::int AS c FROM bookings');
    expect(rows[0].c).toBe(0);
  });

  test('a valid numeric string id still books', async () => {
    const res = await book(String(tripId), 'good');
    expect(res.status).toBe(201);
  });

  test.each(['99999999999', '2147483648', '1e0', '0x1', 'abc'])(
    'cancelling booking %s is the same 404 as an unknown booking, never a 500',
    async (id) => {
      const res = await request(app).post(`/api/bookings/${id}/cancel`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    }
  );

  test.each(['99999999999', '2147483648', '1e0', '0x1', 'abc'])(
    'availability for trip %s is 404, never a 500 and never trip 1',
    async (id) => {
      const res = await request(app).get(`/api/trips/${id}/availability`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('TRIP_NOT_FOUND');
    }
  );

  test.each(['99999999999', '2147483648', '1e0', '0x1'])(
    'an administrator editing or disabling trip %s gets 404 and trip 1 is untouched',
    async (id) => {
      const patch = await request(app)
        .patch(`/api/admin/trips/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fare: 1 });
      const del = await request(app).delete(`/api/admin/trips/${id}`).set('Authorization', `Bearer ${adminToken}`);

      expect(patch.status).toBe(404);
      expect(del.status).toBe(404);
      const { rows } = await pool.query('SELECT fare, enabled FROM trips WHERE id = 1');
      expect(rows[0]).toEqual({ fare: '500.00', enabled: true });
    }
  );
});
