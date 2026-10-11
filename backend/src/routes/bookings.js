const express = require('express');
const bookingService = require('../services/bookingService');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errors');

const router = express.Router();
router.use(requireAuth);

router.post('/', asyncHandler(async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Idempotency-Key header is required.');
  }
  const booking = await bookingService.book({
    userId: req.user.id,
    tripId: req.body.tripId,
    idempotencyKey,
    requestId: req.requestId,
  });
  res.status(201).json(booking);
}));

router.get('/', asyncHandler(async (req, res) => {
  const bookings = await bookingService.listForUser(req.user.id);
  res.status(200).json(bookings);
}));

module.exports = router;
