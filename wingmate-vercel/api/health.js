// api/health.js
require('dotenv').config({ path: '.env.local' });
const { cors } = require('./_lib/auth');

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const checks = {
    server: true,
    database: false,
    pusher: false,
    ai: false,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  };

  try {
    const { query } = require('./_lib/db');
    await query('SELECT 1');
    checks.database = true;
  } catch (e) {
    checks.databaseError = e.message;
  }

  checks.pusher = !!(process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET);
  checks.ai     = !!process.env.ANTHROPIC_API_KEY;

  const missing = ['DATABASE_URL','JWT_SECRET','ANTHROPIC_API_KEY','PUSHER_KEY']
    .filter(k => !process.env[k]);
  if (missing.length) checks.missingEnvVars = missing;

  res.status(checks.database ? 200 : 503).json(checks);
}
