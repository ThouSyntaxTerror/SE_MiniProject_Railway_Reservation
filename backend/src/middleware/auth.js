const authService = require('../services/authService');
const { AppError, asyncHandler } = require('./errors');

// SEC-03: every authenticated route goes through this. Expects `Authorization: Bearer <token>`.
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = await authService.verifySession(token);
  if (!user) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Sign in required.'));
  }
  req.user = user;
  req.sessionToken = token;
  next();
});

module.exports = { requireAuth };
