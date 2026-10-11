class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// §3.4: {"code","message","requestId"} — never a stack trace, SQL, or secret. Only an AppError's
// own status/code/message are ever surfaced; anything else (a raw pg/Node error, say) collapses
// to a generic 500 so its driver-level code/message can't leak to the client.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const isAppError = err instanceof AppError;
  const status = isAppError ? err.status : 500;
  const code = isAppError ? err.code : 'INTERNAL_ERROR';
  const message = isAppError ? err.message : 'Unexpected error.';
  if (!isAppError) console.error(err);
  res.status(status).json({ code, message, requestId: req.requestId });
}

function requestId(req, res, next) {
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  next();
}

// Express 4 doesn't catch rejected promises from async handlers on its own.
function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

module.exports = { AppError, errorHandler, requestId, asyncHandler };
