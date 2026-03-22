// api/_lib/rateLimit.js
// Serverless-compatible rate limiting using Redis
// Falls back to in-memory if Redis is unavailable

const { incrementRateLimit } = require('./redis');

// In-memory fallback (per cold-start instance, not shared across functions)
const memoryStore = new Map();

function memoryRateLimit(key, maxRequests, windowMs) {
  const now = Date.now();
  const windowStart = now - windowMs;
  const requests = (memoryStore.get(key) || []).filter(t => t > windowStart);
  if (requests.length >= maxRequests) return false;
  requests.push(now);
  memoryStore.set(key, requests);
  // Clean up old entries periodically
  if (memoryStore.size > 1000) {
    for (const [k, v] of memoryStore) {
      if (v.every(t => t < windowStart)) memoryStore.delete(k);
    }
  }
  return true;
}

// Returns true if request is allowed, false if rate limited
async function checkRateLimit(identifier, options = {}) {
  const { maxRequests = 30, windowSeconds = 60 } = options;
  const key = `rl:${identifier}`;

  try {
    const count = await incrementRateLimit(key, windowSeconds);
    if (count === null) {
      // Redis unavailable — use memory fallback
      return memoryRateLimit(key, maxRequests, windowSeconds * 1000);
    }
    return count <= maxRequests;
  } catch {
    return memoryRateLimit(key, maxRequests, windowSeconds * 1000);
  }
}

// Middleware wrapper for Vercel handlers
async function withRateLimit(req, res, options, handler) {
  const identifier = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const allowed = await checkRateLimit(identifier, options);
  if (!allowed) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }
  return handler(req, res);
}

module.exports = { checkRateLimit, withRateLimit };
