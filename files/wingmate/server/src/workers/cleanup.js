// server/src/workers/cleanup.js
// Background tasks that run on an interval
// In production you'd use pg_cron or a proper job queue (Bull, BullMQ)
// This simple version runs inside the same process

const { query }            = require('../db/pool');
const { client: redis, deleteCachedSession } = require('../db/redis');
const { releaseWingmate }  = require('../services/matching');

const CLEANUP_INTERVAL_MS  = 5  * 60 * 1000;  // every 5 minutes
const STALE_SESSION_HOURS  = 24;               // sessions older than 24h get force-ended

let cleanupTimer = null;

async function runCleanup() {
  try {
    await pruneExpiredSessions();
    await syncOfflineWingmates();
  } catch (err) {
    console.error('[cleanup worker] error:', err.message);
  }
}

/**
 * Force-end sessions that have been open longer than STALE_SESSION_HOURS
 * and release the Wingmates back into the pool.
 */
async function pruneExpiredSessions() {
  const { rows } = await query(
    `SELECT id, wingmate_id FROM sessions
     WHERE status != 'ended'
       AND (expires_at < NOW() OR started_at < NOW() - INTERVAL '${STALE_SESSION_HOURS} hours')`,
  );

  if (!rows.length) return;

  console.log(`[cleanup] pruning ${rows.length} stale session(s)`);

  for (const session of rows) {
    await query("UPDATE sessions SET status='ended', ended_at=NOW() WHERE id=$1", [session.id]);

    if (session.wingmate_id) {
      await releaseWingmate(session.wingmate_id).catch(() => {});
    }

    await deleteCachedSession(session.id).catch(() => {});

    // Delete messages for ended sessions (ephemeral guarantee)
    await query('DELETE FROM messages WHERE session_id=$1', [session.id]).catch(() => {});
  }
}

/**
 * Mark users as offline if their socket presence has expired in Redis.
 * This handles cases where disconnect events were missed.
 */
async function syncOfflineWingmates() {
  const onlineIds = await redis.hGetAll('online_users').catch(() => ({}));
  const onlineSet = Object.keys(onlineIds);

  if (!onlineSet.length) {
    // Nobody online — make all wingmates available
    await query('UPDATE wingmate_profiles SET available = false WHERE available = true').catch(() => {});
    return;
  }

  // Mark wingmates not in online set as unavailable
  const placeholders = onlineSet.map((_, i) => `$${i + 1}`).join(',');
  await query(
    `UPDATE wingmate_profiles SET available = false
     WHERE available = true AND user_id NOT IN (${placeholders})`,
    onlineSet
  ).catch(() => {});
}

function startCleanupWorker() {
  console.log('[cleanup worker] started — running every 5 minutes');
  runCleanup(); // run immediately on startup
  cleanupTimer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);
}

function stopCleanupWorker() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

module.exports = { startCleanupWorker, stopCleanupWorker };
