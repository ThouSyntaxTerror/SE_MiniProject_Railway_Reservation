// NFR-01 test data: 10,000 trips so search performance can be measured on realistic volume.
// Run with `npm run seed:perf` (idempotent: it only inserts the PERF- rows once).
require('dotenv').config();
const pool = require('../src/db/pool');

async function seed() {
  const { rows } = await pool.query("SELECT count(*)::int AS c FROM trips WHERE train_number LIKE 'PERF-%'");
  if (rows[0].c >= 10000) {
    console.log(`Performance data already present (${rows[0].c} trips).`);
    await pool.end();
    return;
  }

  await pool.query(
    `INSERT INTO trips (train_number, origin, destination, departure_utc, arrival_utc, fare, capacity, enabled)
     SELECT
       'PERF-' || g,
       (ARRAY['Bengaluru','Chennai','Mumbai','Delhi','Pune'])[1 + (g % 5)],
       (ARRAY['Chennai','Bengaluru','Delhi','Mumbai','Pune'])[1 + (g % 5)],
       now() + (g || ' hours')::interval,
       now() + (g || ' hours')::interval + interval '6 hours',
       500 + (g % 400),
       40,
       true
     FROM generate_series(1, 10000) AS g`
  );
  const { rows: after } = await pool.query("SELECT count(*)::int AS c FROM trips WHERE train_number LIKE 'PERF-%'");
  console.log(`Seeded performance trips: ${after[0].c}`);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
