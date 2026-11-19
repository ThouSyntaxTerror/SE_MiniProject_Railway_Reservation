const pool = require('../db/pool');
const auditService = require('./auditService');
const { AppError } = require('../middleware/errors');

const TRIP_FIELDS = ['train_number', 'origin', 'destination', 'departure_utc', 'arrival_utc', 'fare', 'capacity'];
const REQUIRED_FIELDS = [...TRIP_FIELDS];

function parseTripId(tripId) {
  const id = Number(tripId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found.');
  }
  return id;
}

// `existing` lets a PATCH validate the merged state (e.g. only departure_utc supplied) instead of
// comparing two half-present fields.
function validateTripInput(input, { partial = false, existing = null } = {}) {
  if (!partial) {
    for (const field of REQUIRED_FIELDS) {
      if (input[field] === undefined || input[field] === null || input[field] === '') {
        throw new AppError(400, 'VALIDATION_ERROR', `Missing field: ${field}.`);
      }
    }
  }

  for (const field of ['train_number', 'origin', 'destination']) {
    if (input[field] !== undefined && (typeof input[field] !== 'string' || !input[field].trim())) {
      throw new AppError(400, 'VALIDATION_ERROR', `${field} must be a non-empty string.`);
    }
  }

  for (const field of ['departure_utc', 'arrival_utc']) {
    if (input[field] !== undefined && Number.isNaN(Date.parse(input[field]))) {
      throw new AppError(400, 'VALIDATION_ERROR', `${field} must be a valid ISO 8601 timestamp.`);
    }
  }

  if (input.capacity !== undefined && (!Number.isInteger(input.capacity) || input.capacity < 1)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'capacity must be a positive integer.');
  }

  if (input.fare !== undefined) {
    const fare = Number(input.fare);
    if (!Number.isFinite(fare) || fare < 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'fare must be a finite, non-negative number.');
    }
  }

  const departure = input.departure_utc ?? existing?.departure_utc;
  const arrival = input.arrival_utc ?? existing?.arrival_utc;
  if (departure && arrival && new Date(arrival) <= new Date(departure)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'arrival_utc must be after departure_utc.');
  }
}

async function rollbackQuietly(client) {
  try {
    await client.query('ROLLBACK');
  } catch {
    // The original error is the one worth reporting; a broken connection can't roll back.
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
    await rollbackQuietly(client);
    throw err;
  } finally {
    client.release();
  }
}

async function updateTrip(tripId, input, { actorId, requestId }) {
  const id = parseTripId(tripId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM trips WHERE id = $1 FOR UPDATE', [id]);
    const trip = rows[0];
    if (!trip) {
      throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found.');
    }
    validateTripInput(input, { partial: true, existing: trip });

    if (input.capacity !== undefined && input.capacity < trip.capacity) {
      const { rows: taken } = await client.query(
        `SELECT count(*)::int AS c FROM bookings b JOIN seats s ON s.id = b.seat_id
         WHERE b.trip_id = $1 AND b.status = 'confirmed' AND s.seat_number > $2`,
        [id, input.capacity]
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
    values.push(id);
    const { rows: updated } = await client.query(
      `UPDATE trips SET ${updates.join(', ')} WHERE id = $${values.length}
       RETURNING id, train_number, origin, destination, departure_utc, arrival_utc, fare, capacity, enabled`,
      values
    );

    if (input.capacity !== undefined && input.capacity > trip.capacity) {
      for (let seatNumber = trip.capacity + 1; seatNumber <= input.capacity; seatNumber++) {
        await client.query(
          'INSERT INTO seats (trip_id, seat_number) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, seatNumber]
        );
      }
    }

    await auditService.record(client, { actorId, action: 'admin_trip_update', outcome: 'success', requestId });
    await client.query('COMMIT');
    return updated[0];
  } catch (err) {
    await rollbackQuietly(client);
    throw err;
  } finally {
    client.release();
  }
}

// SRS FR-08 says "disable", so DELETE is a soft disable; existing bookings stay readable.
// The state change and its audit row commit together, so an administrator action is never
// persisted without its audit event.
async function disableTrip(tripId, { actorId, requestId }) {
  const id = parseTripId(tripId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'UPDATE trips SET enabled = false WHERE id = $1 RETURNING id',
      [id]
    );
    if (!rows[0]) {
      throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found.');
    }
    await auditService.record(client, { actorId, action: 'admin_trip_disable', outcome: 'success', requestId });
    await client.query('COMMIT');
  } catch (err) {
    await rollbackQuietly(client);
    throw err;
  } finally {
    client.release();
  }
}

async function listAudit({ limit = 100 } = {}) {
  const parsed = Number(limit);
  const capped = Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 500) : 100;
  const { rows } = await pool.query(
    `SELECT a.id, a.actor_id, u.email AS actor_email, a.action, a.outcome, a.created_utc, a.request_id
     FROM audit_events a LEFT JOIN users u ON u.id = a.actor_id
     ORDER BY a.id DESC
     LIMIT $1`,
    [capped]
  );
  return rows;
}

module.exports = { listTrips, createTrip, updateTrip, disableTrip, listAudit };
