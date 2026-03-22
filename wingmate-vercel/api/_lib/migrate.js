// api/_lib/migrate.js
// Run once: node api/_lib/migrate.js
require('dotenv').config({ path: '.env.local' });
const { getPool } = require('./db');

const sql = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias         VARCHAR(50)  NOT NULL,
  email_hash    VARCHAR(255) UNIQUE NOT NULL,
  provider      VARCHAR(20)  NOT NULL DEFAULT 'email',
  provider_id   VARCHAR(255),
  password_hash VARCHAR(255),
  role          VARCHAR(20)  NOT NULL DEFAULT 'seeker',
  age_range     VARCHAR(10),
  needs         TEXT[],
  gender_pref   VARCHAR(20),
  is_online     BOOLEAN DEFAULT false,
  rating        NUMERIC(3,2) DEFAULT 0,
  rating_count  INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wingmate_profiles (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tags          TEXT[],
  bio           TEXT,
  session_count INTEGER DEFAULT 0,
  available     BOOLEAN DEFAULT true,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  wingmate_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  situation     TEXT,
  category      VARCHAR(100),
  status        VARCHAR(20) DEFAULT 'matching',
  call_active   BOOLEAN DEFAULT false,
  call_room_id  VARCHAR(255),
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE TABLE IF NOT EXISTS messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES sessions(id) ON DELETE CASCADE,
  sender_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_role   VARCHAR(20),
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id    UUID,
  type          VARCHAR(30) NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  key_moments   JSONB,
  takeaways     TEXT[],
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ratings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES sessions(id) ON DELETE CASCADE,
  rater_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  rated_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  score         SMALLINT CHECK (score BETWEEN 1 AND 5),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, rater_id)
);

CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_seeker ON sessions(seeker_id);
CREATE INDEX IF NOT EXISTS idx_messages_sess   ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_insights_user   ON insights(user_id);
CREATE INDEX IF NOT EXISTS idx_wm_available    ON wingmate_profiles(available);
`;

async function migrate() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    console.log('Running migrations…');
    await client.query(sql);
    console.log('✓ Done');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
migrate();
