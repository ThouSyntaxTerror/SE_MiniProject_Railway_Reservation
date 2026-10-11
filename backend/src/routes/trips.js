const express = require('express');
const trainSearchService = require('../services/trainSearchService');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const trips = await trainSearchService.search(req.query);
  res.status(200).json(trips);
}));

router.get('/:id/availability', asyncHandler(async (req, res) => {
  const result = await trainSearchService.availability(req.params.id);
  res.status(200).json(result);
}));

module.exports = router;
