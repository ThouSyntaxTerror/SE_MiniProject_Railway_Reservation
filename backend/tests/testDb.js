const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../src/db/pool');

async function resetDb() {
  const schema = fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8');
  await pool.query(schema);
  // Tests run against a real Postgres (docker-compose / CI service); truncate between files
  // instead of dropping so the suite stays fast.
  await pool.query(
    'TRUNCATE audit_events, payment_events, bookings, seats, trips, sessions, users RESTART IDENTITY CASCADE'
  );
}

// `daysAhead` is the common case; `departsIn` accepts any Postgres interval string (e.g. '-1 day')
// for departure-time tests.
async function seedTrip({
  capacity = 2,
  origin = 'Bengaluru',
  destination = 'Chennai',
  daysAhead = 1,
  departsIn = null,
} = {}) {
  const interval = departsIn === null ? `${daysAhead} days` : String(departsIn);
  const { rows } = await pool.query(
    `INSERT INTO trips (train_number, origin, destination, departure_utc, arrival_utc, fare, capacity)
     VALUES ('T1', $2, $3, now() + $4::interval,
             now() + $4::interval + interval '6 hours', 500.00, $1)
     RETURNING id`,
    [capacity, origin, destination, interval]
  );
  const tripId = rows[0].id;
  for (let seatNumber = 1; seatNumber <= capacity; seatNumber++) {
    await pool.query('INSERT INTO seats (trip_id, seat_number) VALUES ($1, $2)', [tripId, seatNumber]);
  }
  return tripId;
}

// Creates a user directly (so tests can choose the role) and returns a live session token.
async function seedUser({
  role = 'passenger',
  email = `user-${crypto.randomBytes(4).toString('hex')}@example.com`,
  password = 'correctpassword123',
  name = 'Test User',
} = {}) {
  const passwordHash = await bcrypt.hash(password, 4);
  const { rows } = await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
    [name, email, passwordHash, role]
  );
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, now() + interval '30 minutes')",
    [token, rows[0].id]
  );
  return token;
}

module.exports = { pool, resetDb, seedTrip, seedUser };
