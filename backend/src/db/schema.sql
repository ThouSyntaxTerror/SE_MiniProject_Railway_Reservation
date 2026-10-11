-- Sprint 1 schema. Entities/fields per 03_Architecture_Design_...pdf §2.3.
-- Trip/seat management (admin CRUD, FR-08) is Sprint 2; for now trips are seeded directly.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'passenger',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  train_number TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_utc TIMESTAMPTZ NOT NULL,
  arrival_utc TIMESTAMPTZ NOT NULL,
  fare NUMERIC(10, 2) NOT NULL,
  capacity INTEGER NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS seats (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id),
  seat_number INTEGER NOT NULL,
  UNIQUE (trip_id, seat_number)
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  pnr TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  trip_id INTEGER NOT NULL REFERENCES trips(id),
  seat_id INTEGER NOT NULL REFERENCES seats(id),
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  UNIQUE (user_id, idempotency_key)
);

-- At most one confirmed booking per seat (FR-05, NFR-03).
CREATE UNIQUE INDEX IF NOT EXISTS one_confirmed_booking_per_seat
  ON bookings (seat_id)
  WHERE status = 'confirmed';

CREATE TABLE IF NOT EXISTS payment_events (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id),
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  reference TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id SERIAL PRIMARY KEY,
  actor_id INTEGER,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_utc TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_id TEXT
);
