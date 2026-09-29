/**
 * Centralized error handler middleware.
 * Catches errors thrown in route handlers and returns consistent JSON responses.
 */
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  console.error(`[ERROR] ${req.method} ${req.path} — ${status}: ${message}`);

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
