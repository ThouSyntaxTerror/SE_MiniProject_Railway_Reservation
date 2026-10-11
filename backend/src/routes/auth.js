const express = require('express');
const authService = require('../services/authService');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => {
  const user = await authService.register({ ...req.body, requestId: req.requestId });
  res.status(201).json(user);
}));

router.post('/sessions', asyncHandler(async (req, res) => {
  const { token, user } = await authService.login({ ...req.body, requestId: req.requestId });
  res.status(200).json({ token, user });
}));

router.delete('/sessions/current', requireAuth, asyncHandler(async (req, res) => {
  await authService.logout({ token: req.sessionToken, requestId: req.requestId });
  res.status(204).end();
}));

module.exports = router;
