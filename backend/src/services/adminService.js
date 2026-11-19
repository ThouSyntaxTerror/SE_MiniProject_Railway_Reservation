const pool = require('../db/pool');
const auditService = require('./auditService');
const { AppError } = require('../middleware/errors');

const TRIP_FIELDS = ['train_number', 'origin', 'destination', 'departure_utc', 'arrival_utc', 'fare', 'capacity'];

function validateTripInput(input, { partial = false } = {}) {
  const required = ['train_number', 'origin', 'destination', 'departure_utc', 'arrival_utc', 'fare', 'capacity'];
  for (const field of required) {
    if (!partial && input[field] === undefined) {
      throw new AppError(400, 'VALIDATION_ERROR', `Missing field: ${field}.`);
    }
  }
  if (input.capacity !== undefined && (!Number.isInteger(input.capacity) || input.capacity < 1)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'capacity must be a positive integer.');
  }
  if (input.fare !== undefined && Number.isNaN(Number(input.fare))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'fare must be numeric.');
  }
  if (input.departure_utc && input.arrival_utc &&
      new Date(input.arrival_utc) <= new Date(input.departure_utc)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'arrival_utc must be after departure_utc.');
  }
}

async function listTrips() {
  const { rows } = await pool.query(
    `SELECT id, train_number, origin, destination, departure_utc, arrival_utc, fare, capacity, enabled
     FROM trips ORDER BY departure_utc ASC`
  );
  return rows;
}

// FR-08: create a trip and materialise its seat rows in one transaction.
async function createTrip(input, { actorId, requestId }) {
  validateTripInput(input);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO trips (train_number, origin, destination, departure_utc, arrival_utc, fare, capacity)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, train_number, origin, destination, departure_utc, arrival_utc, fare, capacity, enabled`,
      [input.train_number, input.origin, input.destination, input.departure_utc,
       input.arrival_utc, input.fare, input.capacity]
    );
    const trip = rows[0];
    for (let seatNumber = 1; seatNumber <= trip.capacity; seatNumber++) {
      await client.query('INSERT INTO seats (trip_id, seat_number) VALUES ($1, $2)', [trip.id, seatNumber]);
    }
    await auditService.record(client, { actorId, action: 'admin_trip_create', outcome: 'success', requestId });
    await client.query('COMMIT');
    return trip;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateTrip(tripId, input, { actorId, requestId }) {
  validateTripInput(input, { partial: true });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM trips WHERE id = $1 FOR UPDATE', [tripId]);
    const trip = rows[0];
    if (!trip) {
      throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found.');
    }

    if (input.capacity !== undefined && input.capacity < trip.capacity) {
      const { rows: taken } = await client.query(
        `SELECT count(*)::int AS c FROM bookings b JOIN seats s ON s.id = b.seat_id
         WHERE b.trip_id = $1 AND b.status = 'confirmed' AND s.seat_number > $2`,
        [tripId, input.capacity]
      );
      if (taken[0].c > 0) {
        throw new AppError(409, 'CAPACITY_IN_USE', 'Cannot shrink capacity below a confirmed seat.');
      }
    }

    const updates = [];
    const values = [];
    for (const field of TRIP_FIELDS) {
      if (input[field] !== undefined) {
        values.push(input[field]);
        updates.push(`${field} = $${values.length}`);
      }
    }
    if (updates.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'No updatable fields supplied.');
    }
    values.push(tripId);
    const { rows: updated } = await client.query(
      `UPDATE trips SET ${updates.join(', ')} WHERE id = $${values.length}
       RETURNING id, train_number, origin, destination, departure_utc, arrival_utc, fare, capacity, enabled`,
      values
    );

    if (input.capacity !== undefined && input.capacity > trip.capacity) {
      for (let seatNumber = trip.capacity + 1; seatNumber <= input.capacity; seatNumber++) {
        await client.query(
          'INSERT INTO seats (trip_id, seat_number) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [tripId, seatNumber]
        );
      }
    }

    await auditService.record(client, { actorId, action: 'admin_trip_update', outcome: 'success', requestId });
    await client.query('COMMIT');
    return updated[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// SRS FR-08 says "disable", so DELETE is a soft disable; existing bookings stay readable.
async function disableTrip(tripId, { actorId, requestId }) {
  const { rows } = await pool.query(
    'UPDATE trips SET enabled = false WHERE id = $1 RETURNING id',
    [tripId]
  );
  if (!rows[0]) {
    throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found.');
  }
  await auditService.record(pool, { actorId, action: 'admin_trip_disable', outcome: 'success', requestId });
}

async function listAudit({ limit = 100 } = {}) {
  const { rows } = await pool.query(
    `SELECT a.id, a.actor_id, u.email AS actor_email, a.action, a.outcome, a.created_utc, a.request_id
     FROM audit_events a LEFT JOIN users u ON u.id = a.actor_id
     ORDER BY a.id DESC
     LIMIT $1`,
    [Math.min(Number(limit) || 100, 500)]
  );
  return rows;
}

module.exports = { listTrips, createTrip, updateTrip, disableTrip, listAudit };
