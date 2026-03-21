// server/src/db/seed.js
// Creates demo Wingmate accounts for testing
// Run: node src/db/seed.js

require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('./pool');

const wingmates = [
  {
    alias: 'Sage',
    email: 'sage@demo.wingmate',
    role: 'wingmate',
    tags: ['mixed signals', 'emotional distance', 'breakups', 'texting'],
    bio: 'I\'ve navigated a lot of confusing relationship moments. I listen without judgment.',
    rating: 4.9,
  },
  {
    alias: 'River',
    email: 'river@demo.wingmate',
    role: 'wingmate',
    tags: ['communication gaps', 'conflict resolution', 'friendships'],
    bio: 'I help people see what\'s actually being communicated vs what\'s being assumed.',
    rating: 4.8,
  },
  {
    alias: 'Nova',
    email: 'nova@demo.wingmate',
    role: 'wingmate',
    tags: ['overthinking patterns', 'anxiety', 'self-doubt', 'mixed signals'],
    bio: 'I specialise in the gap between overthinking and reality.',
    rating: 5.0,
  },
  {
    alias: 'Cedar',
    email: 'cedar@demo.wingmate',
    role: 'wingmate',
    tags: ['breakups', 'moving on', 'self-worth', 'new relationships'],
    bio: 'Navigated several difficult endings. I understand how to find clarity in loss.',
    rating: 4.7,
  },
  {
    alias: 'Wren',
    email: 'wren@demo.wingmate',
    role: 'wingmate',
    tags: ['conversation starter', 'first moves', 'confidence', 'social anxiety'],
    bio: 'Great at helping people find the right words for hard conversations.',
    rating: 4.8,
  },
];

function hashEmail(email) {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding demo Wingmates…');
    const passwordHash = await bcrypt.hash('demo_wingmate_pw', 12);

    for (const wm of wingmates) {
      const emailHash = hashEmail(wm.email);

      // Upsert user
      const { rows } = await client.query(
        `INSERT INTO users (alias, email_hash, provider, password_hash, role, rating, rating_count)
         VALUES ($1,$2,'email',$3,$4,$5,$6)
         ON CONFLICT (email_hash) DO UPDATE
           SET alias = EXCLUDED.alias, rating = EXCLUDED.rating
         RETURNING id`,
        [wm.alias, emailHash, passwordHash, wm.role, wm.rating, Math.floor(Math.random() * 80) + 20]
      );

      const userId = rows[0].id;

      // Upsert wingmate profile
      await client.query(
        `INSERT INTO wingmate_profiles (user_id, tags, bio, session_count, available)
         VALUES ($1,$2,$3,$4,true)
         ON CONFLICT (user_id) DO UPDATE
           SET tags = EXCLUDED.tags, bio = EXCLUDED.bio, available = true`,
        [userId, wm.tags, wm.bio, Math.floor(Math.random() * 60) + 10]
      );

      console.log(`  ✓ ${wm.alias} (${userId.slice(0,8)}…)`);
    }

    console.log('\n✓ Seed complete. Demo Wingmates are available for matching.');
    console.log('  Password for all demo accounts: demo_wingmate_pw');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
