const express = require('express');
const adminService = require('../services/adminService');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

// SEC-01 / FR-08: every administrator route validates the session and the role server-side.
router.use(requireAuth, requireRole('admin'));

router.get('/trips', asyncHandler(async (req, res) => {
  res.status(200).json(await adminService.listTrips());
}));

router.post('/trips', asyncHandler(async (req, res) => {
  const trip = await adminService.createTrip(req.body, { actorId: req.user.id, requestId: req.requestId });
  res.status(201).json(trip);
}));

router.patch('/trips/:id', asyncHandler(async (req, res) => {
  const trip = await adminService.updateTrip(req.params.id, req.body, {
    actorId: req.user.id,
    requestId: req.requestId,
  });
  res.status(200).json(trip);
}));

router.delete('/trips/:id', asyncHandler(async (req, res) => {
  await adminService.disableTrip(req.params.id, { actorId: req.user.id, requestId: req.requestId });
  res.status(204).end();
}));

router.get('/audit', asyncHandler(async (req, res) => {
  res.status(200).json(await adminService.listAudit(req.query));
}));

module.exports = router;
