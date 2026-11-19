const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  await seedDemoData();
  await pool.end();
  console.log('Migration complete.');
}

// Seeded identities make the demo and the Part 2 videos reproducible.
// Override the demo credentials with ADMIN_EMAIL / ADMIN_PASSWORD in backend/.env.
//
// SECURITY: this NEVER promotes an existing account. If an account already owns the configured
// admin email it is left exactly as it is (role included); provisioning an administrator is an
// explicit operator action, not a migration side effect.
async function seedDemoData() {
  const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@rrs.test').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123';
  const adminHash = await bcrypt.hash(adminPassword, rounds);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('RRS Administrator', $1, $2, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [adminEmail, adminHash]
  );

  const passengerEmail = 'passenger@rrs.test';
  const passengerHash = await bcrypt.hash('PassengerPass123', rounds);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Demo Passenger', $1, $2, 'passenger')
     ON CONFLICT (email) DO NOTHING`,
    [passengerEmail, passengerHash]
  );

  const { rows } = await pool.query('SELECT id FROM trips LIMIT 1');
  if (rows.length > 0) return;

  const { rows: tripRows } = await pool.query(
    `INSERT INTO trips (train_number, origin, destination, departure_utc, arrival_utc, fare, capacity)
     VALUES
       ('12627', 'Bengaluru', 'Chennai', now() + interval '1 day', now() + interval '1 day 6 hours', 650.00, 5),
       ('12007', 'Bengaluru', 'Chennai', now() + interval '2 days', now() + interval '2 days 5 hours', 480.00, 40),
       ('12628', 'Chennai', 'Bengaluru', now() + interval '3 days', now() + interval '3 days 6 hours', 620.00, 40)
     RETURNING id, capacity`
  );
  for (const trip of tripRows) {
    for (let seatNumber = 1; seatNumber <= trip.capacity; seatNumber++) {
      await pool.query('INSERT INTO seats (trip_id, seat_number) VALUES ($1, $2)', [trip.id, seatNumber]);
    }
  }
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { migrate, seedDemoData };
