// api/_lib/seed.js
// Run once after migrate: node api/_lib/seed.js
require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getPool } = require('./db');

const wingmates = [
  { alias: 'Sage',  email: 'sage@demo.wingmate',  tags: ['mixed signals','emotional distance','breakups'],       bio: "I've navigated a lot of confusing relationship moments. I listen without judgment.", rating: 4.9 },
  { alias: 'River', email: 'river@demo.wingmate', tags: ['communication gaps','conflict resolution','friendships'], bio: "I help people see what's actually being communicated vs what's assumed.",          rating: 4.8 },
  { alias: 'Nova',  email: 'nova@demo.wingmate',  tags: ['overthinking','anxiety','self-doubt','mixed signals'],  bio: "I specialise in the gap between overthinking and reality.",                         rating: 5.0 },
  { alias: 'Cedar', email: 'cedar@demo.wingmate', tags: ['breakups','moving on','self-worth'],                    bio: "Navigated several difficult endings. I understand how to find clarity in loss.",     rating: 4.7 },
  { alias: 'Wren',  email: 'wren@demo.wingmate',  tags: ['conversation starter','confidence','social anxiety'],   bio: "Great at helping people find the right words for hard conversations.",               rating: 4.8 },
];

async function seed() {
  const pool = getPool();
  const client = await pool.connect();
  const pw = await bcrypt.hash('demo_pw_123', 12);
  try {
    for (const wm of wingmates) {
      const hash = crypto.createHash('sha256').update(wm.email).digest('hex');
      const { rows } = await client.query(
        `INSERT INTO users (alias, email_hash, provider, password_hash, role, rating, rating_count)
         VALUES ($1,$2,'email',$3,'wingmate',$4,$5)
         ON CONFLICT (email_hash) DO UPDATE SET alias=EXCLUDED.alias RETURNING id`,
        [wm.alias, hash, pw, wm.rating, Math.floor(Math.random()*80)+20]
      );
      await client.query(
        `INSERT INTO wingmate_profiles (user_id, tags, bio, session_count, available)
         VALUES ($1,$2,$3,$4,true)
         ON CONFLICT (user_id) DO UPDATE SET tags=EXCLUDED.tags, bio=EXCLUDED.bio`,
        [rows[0].id, wm.tags, wm.bio, Math.floor(Math.random()*60)+10]
      );
      console.log(`✓ ${wm.alias}`);
    }
    console.log('\nSeed complete!');
  } finally {
    client.release();
    await pool.end();
  }
}
seed().catch(e => { console.error(e.message); process.exit(1); });
