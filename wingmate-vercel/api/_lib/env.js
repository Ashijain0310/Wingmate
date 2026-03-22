// api/_lib/env.js
// Call validateEnv() at the top of any serverless function that needs it
// Returns an error response if critical vars are missing

const REQUIRED = {
  DATABASE_URL:      'PostgreSQL connection string (get from neon.tech)',
  JWT_SECRET:        'Random secret string for signing tokens',
  ANTHROPIC_API_KEY: 'Claude API key (get from console.anthropic.com)',
};

const RECOMMENDED = {
  PUSHER_APP_ID:  'Pusher App ID (get from pusher.com) — needed for real-time',
  PUSHER_KEY:     'Pusher Key — needed for real-time',
  PUSHER_SECRET:  'Pusher Secret — needed for real-time',
  REDIS_URL:      'Upstash Redis URL (get from upstash.com) — needed for presence',
};

function validateEnv(res) {
  const missing = Object.entries(REQUIRED)
    .filter(([key]) => !process.env[key])
    .map(([key, hint]) => `${key}: ${hint}`);

  if (missing.length > 0) {
    console.error('[env] Missing required environment variables:\n', missing.join('\n'));
    if (res) {
      res.status(500).json({
        error:   'Server misconfigured — missing environment variables',
        missing: missing.map(m => m.split(':')[0]),
        hint:    'Add these in Vercel → Project Settings → Environment Variables',
      });
    }
    return false;
  }

  const missingRecommended = Object.entries(RECOMMENDED)
    .filter(([key]) => !process.env[key])
    .map(([key]) => key);

  if (missingRecommended.length > 0) {
    console.warn('[env] Missing recommended variables (some features will be disabled):', missingRecommended.join(', '));
  }

  return true;
}

module.exports = { validateEnv };
