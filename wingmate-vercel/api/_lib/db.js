// api/_lib/db.js
// Shared across all serverless functions
// Vercel reuses warm instances so connection pooling works well

const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // required for Neon / Supabase
      max: 5,                             // keep low for serverless
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', (err) => console.error('DB pool error:', err.message));
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, withTransaction, getPool };
