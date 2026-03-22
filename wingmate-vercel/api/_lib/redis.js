// api/_lib/redis.js
// Upstash Redis — HTTP-based, works perfectly in Vercel serverless
// No persistent connections needed. Each request is a fresh HTTP call.
// Install: already included via fetch (no extra package needed for Upstash REST API)

const REDIS_URL    = process.env.REDIS_URL    || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN  = process.env.REDIS_TOKEN  || process.env.UPSTASH_REDIS_REST_TOKEN;

// Upstash REST API helper
async function redisCommand(command, ...args) {
  if (!REDIS_URL) {
    console.warn('[redis] REDIS_URL not set — skipping cache operation');
    return null;
  }

  // Support both Upstash REST URL and standard redis:// URL
  // If standard redis URL, we skip (no persistent connection in serverless)
  if (REDIS_URL.startsWith('redis://') || REDIS_URL.startsWith('rediss://')) {
    // For standard Redis URLs, use ioredis if available
    try {
      const Redis = require('ioredis');
      const client = new Redis(REDIS_URL, {
        tls: REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        lazyConnect: true,
      });
      await client.connect().catch(() => {});
      const result = await client[command.toLowerCase()](...args);
      await client.quit();
      return result;
    } catch {
      return null;
    }
  }

  // Upstash REST API
  const url = `${REDIS_URL}/${[command, ...args].map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, {
    headers: REDIS_TOKEN ? { Authorization: `Bearer ${REDIS_TOKEN}` } : {},
  });
  const data = await res.json();
  return data.result ?? null;
}

// Presence helpers
async function setUserOnline(userId, data = '1') {
  return redisCommand('SETEX', `online:${userId}`, 3600, JSON.stringify(data));
}

async function setUserOffline(userId) {
  return redisCommand('DEL', `online:${userId}`);
}

async function isUserOnline(userId) {
  const r = await redisCommand('GET', `online:${userId}`);
  return r !== null;
}

async function getOnlineWingmates(limit = 50) {
  // Get all online users - in production you'd use a Redis Set
  // This is a simplified version using SCAN
  try {
    const keys = await redisCommand('KEYS', 'online:*');
    if (!keys || !Array.isArray(keys)) return [];
    return keys.slice(0, limit).map(k => k.replace('online:', ''));
  } catch {
    return [];
  }
}

// Session cache
async function cacheSession(sessionId, data, ttl = 3600) {
  return redisCommand('SETEX', `session:${sessionId}`, ttl, JSON.stringify(data));
}

async function getCachedSession(sessionId) {
  const raw = await redisCommand('GET', `session:${sessionId}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function deleteCachedSession(sessionId) {
  return redisCommand('DEL', `session:${sessionId}`);
}

// Rate limiting helper (for AI endpoint)
async function incrementRateLimit(key, windowSeconds) {
  const count = await redisCommand('INCR', `rl:${key}`);
  if (count === 1) await redisCommand('EXPIRE', `rl:${key}`, windowSeconds);
  return count;
}

module.exports = {
  setUserOnline, setUserOffline, isUserOnline, getOnlineWingmates,
  cacheSession, getCachedSession, deleteCachedSession,
  incrementRateLimit,
};
