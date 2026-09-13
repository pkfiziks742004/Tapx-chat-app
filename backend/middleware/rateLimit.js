function getClientAddress(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwarded || req.ip || req.socket?.remoteAddress || "unknown";
}

function createRateLimiter({
  windowMs,
  max,
  keyGenerator,
  message = "Too many requests. Please try again later.",
  code = "over_request_rate_limit"
} = {}) {
  const safeWindowMs = Number.isFinite(windowMs) ? Math.max(1000, windowMs) : 60 * 1000;
  const safeMax = Number.isFinite(max) ? Math.max(1, max) : 10;
  const buckets = new Map();

  return (req, res, next) => {
    const key = String((keyGenerator ? keyGenerator(req) : getClientAddress(req)) || "").trim();
    if (!key) return next();

    const now = Date.now();
    const existing = buckets.get(key) || [];
    const recent = existing.filter((ts) => now - ts < safeWindowMs);

    if (recent.length >= safeMax) {
      const retryAfterSeconds = Math.max(1, Math.ceil((safeWindowMs - (now - recent[0])) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ message, code, retryAfterSeconds });
    }

    recent.push(now);
    buckets.set(key, recent);
    return next();
  };
}

module.exports = { createRateLimiter, getClientAddress };
