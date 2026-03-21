// server/src/db/migrate.js
// Run with: node src/db/migrate.js

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrations = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS table (no real names stored — alias only)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias         VARCHAR(50) NOT NULL,
  email_hash    VARCHAR(255) UNIQUE NOT NULL,  -- hashed, never plain
  provider      VARCHAR(20) NOT NULL DEFAULT 'email', -- 'email'|'google'|'apple'
  provider_id   VARCHAR(255),                  -- OAuth subject ID
  password_hash VARCHAR(255),                  -- null for OAuth users
  role          VARCHAR(20) NOT NULL DEFAULT 'seeker', -- 'seeker'|'wingmate'|'both'
  age_range     VARCHAR(10),
  needs         TEXT[],                        -- ['listen','advice','wording','pattern']
  gender_pref   VARCHAR(20),
  is_online     BOOLEAN DEFAULT false,
  rating        NUMERIC(3,2) DEFAULT 0,
  rating_count  INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- WINGMATE PROFILES (extra info for users who are wingmates)
CREATE TABLE IF NOT EXISTS wingmate_profiles (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tags          TEXT[],                        -- e.g. ['breakups','mixed signals']
  bio           TEXT,
  session_count INTEGER DEFAULT 0,
  embedding     FLOAT8[],                      -- for similarity matching
  available     BOOLEAN DEFAULT true,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- SESSIONS (ephemeral — auto-deleted after TTL)
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  wingmate_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  situation     TEXT,                          -- seeker's initial description
  category      VARCHAR(100),
  status        VARCHAR(20) DEFAULT 'matching', -- 'matching'|'active'|'ended'
  call_active   BOOLEAN DEFAULT false,
  call_room_id  VARCHAR(255),
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- MESSAGES (ephemeral — deleted when session ends)
CREATE TABLE IF NOT EXISTS messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES sessions(id) ON DELETE CASCADE,
  sender_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_role   VARCHAR(20),                   -- 'seeker'|'wingmate'|'ai_note'
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- AI INSIGHTS (kept after session ends — user controls deletion)
CREATE TABLE IF NOT EXISTS insights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id    UUID,                          -- nullable — session may be gone
  type          VARCHAR(30) NOT NULL,          -- 'clarity'|'pattern'|'action'
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  key_moments   JSONB,
  takeaways     TEXT[],
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RATINGS
CREATE TABLE IF NOT EXISTS ratings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES sessions(id) ON DELETE CASCADE,
  rater_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  rated_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  score         SMALLINT CHECK (score BETWEEN 1 AND 5),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, rater_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email_hash     ON users(email_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_seeker      ON sessions(seeker_id);
CREATE INDEX IF NOT EXISTS idx_sessions_wingmate    ON sessions(wingmate_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status      ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_messages_session     ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_insights_user        ON insights(user_id);
CREATE INDEX IF NOT EXISTS idx_wingmate_available   ON wingmate_profiles(available);

-- Auto-cleanup expired sessions (run periodically via cron or pg_cron)
-- DELETE FROM sessions WHERE expires_at < NOW() AND status = 'ended';
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    await client.query(migrations);
    console.log('✓ Migrations complete');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
