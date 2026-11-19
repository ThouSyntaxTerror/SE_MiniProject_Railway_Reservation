const pool = require('../db/pool');
const { AppError } = require('../middleware/errors');

// FR-03: only trips matching all three filters, departing on or after the requested date,
// ordered by departure time (SRS §4.1 FR-03).
async function search({ origin, destination, date }) {
  if (!origin || !destination || !date) {
    throw new AppError(400, 'VALIDATION_ERROR', 'origin, destination and date are all required.');
  }
  if (Number.isNaN(Date.parse(date))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'date must be an ISO 8601 date.');
  }
  const { rows } = await pool.query(
    `SELECT id, train_number, origin, destination, departure_utc, arrival_utc, fare, capacity
     FROM trips
     WHERE enabled
       AND lower(origin) = lower($1)
       AND lower(destination) = lower($2)
       AND departure_utc >= $3::date
     ORDER BY departure_utc ASC`,
    [origin.trim(), destination.trim(), date]
  );
  return rows;
}

// FR-04: unreserved seats, clamped to [0, capacity]. Disabled trips are not bookable.
async function availability(tripId) {
  const { rows } = await pool.query('SELECT capacity, enabled FROM trips WHERE id = $1', [tripId]);
  const trip = rows[0];
  if (!trip) {
    throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found.');
  }
  const { rows: countRows } = await pool.query(
    `SELECT count(*)::int AS confirmed
     FROM bookings
     WHERE trip_id = $1 AND status = 'confirmed'`,
    [tripId]
  );
  const unreserved = Math.min(trip.capacity, Math.max(0, trip.capacity - countRows[0].confirmed));
  return { tripId: Number(tripId), capacity: trip.capacity, unreserved, enabled: trip.enabled };
}

module.exports = { search, availability };
