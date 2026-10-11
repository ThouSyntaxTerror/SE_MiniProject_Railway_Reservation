const fs = require('fs');
const path = require('path');
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

async function seedTrip({ capacity = 2 } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO trips (train_number, origin, destination, departure_utc, arrival_utc, fare, capacity)
     VALUES ('T1', 'Bengaluru', 'Chennai', now() + interval '1 day', now() + interval '1 day 6 hours', 500.00, $1)
     RETURNING id`,
    [capacity]
  );
  const tripId = rows[0].id;
  for (let seatNumber = 1; seatNumber <= capacity; seatNumber++) {
    await pool.query('INSERT INTO seats (trip_id, seat_number) VALUES ($1, $2)', [tripId, seatNumber]);
  }
  return tripId;
}

module.exports = { pool, resetDb, seedTrip };
