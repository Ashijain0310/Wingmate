-- Wingmate Database Setup
-- Paste this into your Neon SQL Editor at neon.tech
-- Project → SQL Editor → paste → Run

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  alias         VARCHAR(50) NOT NULL,
  email_hash    VARCHAR(255) UNIQUE NOT NULL,
  provider      VARCHAR(20) NOT NULL DEFAULT 'email',
  provider_id   VARCHAR(255),
  password_hash VARCHAR(255),
  role          VARCHAR(20) NOT NULL DEFAULT 'seeker',
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
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_messages_sess   ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_insights_user   ON insights(user_id);
CREATE INDEX IF NOT EXISTS idx_wm_available    ON wingmate_profiles(available);

-- Seed 5 demo Wingmates for testing
-- Password for all: demo_pw_123 (bcrypt hash below)
WITH wm AS (
  INSERT INTO users (alias, email_hash, provider, password_hash, role, rating, rating_count)
  VALUES
    ('Sage',  encode(digest('sage@demo.wingmate',  'sha256'), 'hex'), 'email', '$2a$12$K9BQ7v5s6lN4vI8MqZbx8.mE5h3W2vZk9eN1oP3xR6sT7uY8wA2Ce', 'wingmate', 4.9, 48),
    ('River', encode(digest('river@demo.wingmate', 'sha256'), 'hex'), 'email', '$2a$12$K9BQ7v5s6lN4vI8MqZbx8.mE5h3W2vZk9eN1oP3xR6sT7uY8wA2Ce', 'wingmate', 4.8, 31),
    ('Nova',  encode(digest('nova@demo.wingmate',  'sha256'), 'hex'), 'email', '$2a$12$K9BQ7v5s6lN4vI8MqZbx8.mE5h3W2vZk9eN1oP3xR6sT7uY8wA2Ce', 'wingmate', 5.0, 62),
    ('Cedar', encode(digest('cedar@demo.wingmate', 'sha256'), 'hex'), 'email', '$2a$12$K9BQ7v5s6lN4vI8MqZbx8.mE5h3W2vZk9eN1oP3xR6sT7uY8wA2Ce', 'wingmate', 4.7, 27),
    ('Wren',  encode(digest('wren@demo.wingmate',  'sha256'), 'hex'), 'email', '$2a$12$K9BQ7v5s6lN4vI8MqZbx8.mE5h3W2vZk9eN1oP3xR6sT7uY8wA2Ce', 'wingmate', 4.8, 39)
  ON CONFLICT (email_hash) DO UPDATE SET alias = EXCLUDED.alias
  RETURNING id, alias
)
INSERT INTO wingmate_profiles (user_id, tags, bio, session_count, available)
SELECT
  w.id,
  CASE w.alias
    WHEN 'Sage'  THEN ARRAY['mixed signals','emotional distance','breakups','texting']
    WHEN 'River' THEN ARRAY['communication gaps','conflict resolution','friendships']
    WHEN 'Nova'  THEN ARRAY['overthinking','anxiety','self-doubt','mixed signals']
    WHEN 'Cedar' THEN ARRAY['breakups','moving on','self-worth','new relationships']
    WHEN 'Wren'  THEN ARRAY['conversation starter','confidence','social anxiety']
  END,
  CASE w.alias
    WHEN 'Sage'  THEN 'I listen without judgment and help you see situations clearly.'
    WHEN 'River' THEN 'I help untangle what is being communicated vs what is being assumed.'
    WHEN 'Nova'  THEN 'I specialise in the gap between overthinking and reality.'
    WHEN 'Cedar' THEN 'I understand how to find clarity after difficult endings.'
    WHEN 'Wren'  THEN 'I help people find the right words for hard conversations.'
  END,
  floor(random() * 60 + 10)::int,
  true
FROM wm w
ON CONFLICT (user_id) DO UPDATE SET tags = EXCLUDED.tags, bio = EXCLUDED.bio, available = true;
