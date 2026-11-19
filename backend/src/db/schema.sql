-- Sprint 2 schema. Entities/fields per 03_Architecture_Design_...pdf §2.3.
-- Safe to re-run: every statement is idempotent so `npm run migrate` upgrades an existing DB.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'passenger',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FR-01: passenger name is part of the account (SRS §4.1).
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
-- SEC-04: lockout state.
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

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

-- NFR-01: makes the FR-03 filter/order an index scan instead of a full table scan.
CREATE INDEX IF NOT EXISTS trips_search_idx
  ON trips (origin, destination, departure_utc)
  WHERE enabled;

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
  created_utc TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_utc TIMESTAMPTZ,
  refund_reference TEXT,
  UNIQUE (user_id, idempotency_key)
);

-- Existing databases from Sprint 1 lack the cancellation columns.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_utc TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_utc TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_reference TEXT;

-- At most one confirmed booking per seat (FR-05, NFR-03).
CREATE UNIQUE INDEX IF NOT EXISTS one_confirmed_booking_per_seat
  ON bookings (seat_id)
  WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings (user_id, id DESC);

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

CREATE INDEX IF NOT EXISTS audit_events_recent_idx ON audit_events (id DESC);
