const pool = require('../db/pool');
const { AppError } = require('../middleware/errors');

// FR-03: only trips matching all three filters, ordered by departure time.
async function search({ origin, destination, date }) {
  if (!origin || !destination || !date) {
    throw new AppError(400, 'VALIDATION_ERROR', 'origin, destination and date are all required.');
  }
  const { rows } = await pool.query(
    `SELECT id, train_number, origin, destination, departure_utc, arrival_utc, fare, capacity
     FROM trips
     WHERE enabled
       AND origin = $1
       AND destination = $2
       AND departure_utc::date = $3::date
     ORDER BY departure_utc ASC`,
    [origin, destination, date]
  );
  return rows;
}

// FR-04: unreserved seats, clamped to [0, capacity] by construction (count can't exceed capacity
// because `seats` only ever has `capacity` rows for the trip).
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
  const unreserved = trip.capacity - countRows[0].confirmed;
  return { tripId: Number(tripId), capacity: trip.capacity, unreserved: Math.max(0, unreserved) };
}

module.exports = { search, availability };
