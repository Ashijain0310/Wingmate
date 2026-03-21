// server/src/db/redis.js
const { createClient } = require('redis');

const client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });

client.on('error', (err) => console.error('Redis error:', err));
client.on('connect', () => console.log('✓ Redis connected'));

async function connectRedis() {
  if (!client.isOpen) await client.connect();
  return client;
}

// Presence helpers
async function setUserOnline(userId, socketId) {
  await client.hSet('online_users', userId, socketId);
  await client.expire('online_users', 86400);
}

async function setUserOffline(userId) {
  await client.hDel('online_users', userId);
}

async function getOnlineWingmates(limit = 20) {
  const all = await client.hGetAll('online_users');
  return Object.keys(all).slice(0, limit);
}

// Matching queue — seekers waiting for a match
async function enqueueSeeker(sessionId, data) {
  await client.lPush('match_queue', JSON.stringify({ sessionId, ...data }));
}

async function dequeueSeeker() {
  const raw = await client.rPop('match_queue');
  return raw ? JSON.parse(raw) : null;
}

// Session cache (fast lookups)
async function cacheSession(sessionId, data, ttl = 3600) {
  await client.setEx(`session:${sessionId}`, ttl, JSON.stringify(data));
}

async function getCachedSession(sessionId) {
  const raw = await client.get(`session:${sessionId}`);
  return raw ? JSON.parse(raw) : null;
}

async function deleteCachedSession(sessionId) {
  await client.del(`session:${sessionId}`);
}

module.exports = {
  client,
  connectRedis,
  setUserOnline,
  setUserOffline,
  getOnlineWingmates,
  enqueueSeeker,
  dequeueSeeker,
  cacheSession,
  getCachedSession,
  deleteCachedSession,
};
