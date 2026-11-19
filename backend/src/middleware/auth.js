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

// SEC-01: role check happens on the server, never in the browser.
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
