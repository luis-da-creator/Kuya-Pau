// Tiny in-memory limiter for login/register routes (per IP).
module.exports = function rateLimit({ windowMs = 15 * 60e3, max = 20 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 5000) hits.clear();
    const recent = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      return res.status(429).json({ message: 'Too many attempts. Please try again in a few minutes.' });
    }
    recent.push(now);
    hits.set(req.ip, recent);
    next();
  };
};
