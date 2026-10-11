const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  await seedDemoTrip();
  await pool.end();
  console.log('Migration complete.');
}

// One demo trip with 5 seats so search/booking can be exercised locally without an admin UI
// (trip management is FR-08, Sprint 2).
async function seedDemoTrip() {
  const { rows } = await pool.query('SELECT id FROM trips LIMIT 1');
  if (rows.length > 0) return;
  const { rows: tripRows } = await pool.query(
    `INSERT INTO trips (train_number, origin, destination, departure_utc, arrival_utc, fare, capacity)
     VALUES ('12627', 'Bengaluru', 'Chennai', now() + interval '1 day', now() + interval '1 day 6 hours', 650.00, 5)
     RETURNING id`
  );
  const tripId = tripRows[0].id;
  for (let seatNumber = 1; seatNumber <= 5; seatNumber++) {
    await pool.query('INSERT INTO seats (trip_id, seat_number) VALUES ($1, $2)', [tripId, seatNumber]);
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
