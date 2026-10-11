const crypto = require('crypto');
const pool = require('../db/pool');
const paymentSimulator = require('../paymentSimulator');
const auditService = require('./auditService');
const { AppError } = require('../middleware/errors');

function generatePnr() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function fetchBookingView(db, bookingId) {
  const { rows } = await db.query(
    `SELECT b.id, b.pnr, b.status, b.trip_id, t.train_number, t.origin, t.destination,
            t.departure_utc, t.fare, s.seat_number
     FROM bookings b
     JOIN trips t ON t.id = b.trip_id
     JOIN seats s ON s.id = b.seat_id
     WHERE b.id = $1`,
    [bookingId]
  );
  return rows[0];
}

// FR-05: idempotent booking. One DB transaction locks a seat, calls the payment simulator, and
// either confirms with a unique PNR or releases the hold — see bookingService design in the
// scaffold plan / architecture doc §3.1 for the full state-machine reasoning.
async function book({ userId, tripId, idempotencyKey, requestId }) {
  if (!tripId || !idempotencyKey) {
    throw new AppError(400, 'VALIDATION_ERROR', 'tripId and an Idempotency-Key header are required.');
  }
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id FROM bookings WHERE user_id = $1 AND idempotency_key = $2',
      [userId, idempotencyKey]
    );
    if (existing.rows[0]) {
      await client.query('COMMIT');
      committed = true;
      return fetchBookingView(pool, existing.rows[0].id);
    }

    // SKIP LOCKED lets concurrent requests pick different seats instead of queuing; the partial
    // unique index on confirmed bookings (schema.sql) is still the final guard against a double
    // allocation if two transactions somehow target the same seat (NFR-03).
    const seatResult = await client.query(
      `SELECT s.id FROM seats s
       WHERE s.trip_id = $1
         AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.seat_id = s.id AND b.status = 'confirmed')
       ORDER BY s.seat_number
       FOR UPDATE OF s SKIP LOCKED
       LIMIT 1`,
      [tripId]
    );
    const seat = seatResult.rows[0];
    if (!seat) {
      await auditService.record(client, { actorId: userId, action: 'booking', outcome: 'seat_unavailable', requestId });
      await client.query('COMMIT');
      committed = true;
      throw new AppError(409, 'SEAT_UNAVAILABLE', 'No seats available on this trip.');
    }

    const payment = paymentSimulator.authorize(`${userId}:${idempotencyKey}`);
    if (payment.status !== 'success') {
      await client.query(
        'INSERT INTO payment_events (booking_id, kind, status, reference) VALUES (NULL, $1, $2, $3)',
        ['authorize', 'failed', payment.reference]
      );
      await auditService.record(client, { actorId: userId, action: 'booking', outcome: 'payment_failed', requestId });
      await client.query('COMMIT'); // releases the seat hold; no confirmed booking was created
      committed = true;
      throw new AppError(402, 'PAYMENT_FAILED', 'Payment was not authorized.');
    }

    const { rows } = await client.query(
      `INSERT INTO bookings (pnr, user_id, trip_id, seat_id, status, idempotency_key)
       VALUES ($1, $2, $3, $4, 'confirmed', $5)
       RETURNING id`,
      [generatePnr(), userId, tripId, seat.id, idempotencyKey]
    );
    const bookingId = rows[0].id;
    await client.query(
      'INSERT INTO payment_events (booking_id, kind, status, reference) VALUES ($1, $2, $3, $4)',
      [bookingId, 'authorize', 'success', payment.reference]
    );
    await auditService.record(client, { actorId: userId, action: 'booking', outcome: 'confirmed', requestId });
    await client.query('COMMIT');
    committed = true;
    return fetchBookingView(pool, bookingId);
  } catch (err) {
    if (!committed) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // connection already broken; nothing more to do
      }
    }
    throw err;
  } finally {
    client.release();
  }
}

// FR-06: a passenger sees only their own bookings.
async function listForUser(userId) {
  const { rows } = await pool.query(
    `SELECT b.id, b.pnr, b.status, t.train_number, t.origin, t.destination, t.departure_utc,
            t.fare, s.seat_number
     FROM bookings b
     JOIN trips t ON t.id = b.trip_id
     JOIN seats s ON s.id = b.seat_id
     WHERE b.user_id = $1
     ORDER BY b.id DESC`,
    [userId]
  );
  return rows;
}

module.exports = { book, listForUser };
