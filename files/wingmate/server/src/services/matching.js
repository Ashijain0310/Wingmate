// server/src/services/matching.js
// Matches a seeker with the best available Wingmate based on:
// 1. Online/available status
// 2. Tag overlap with seeker's situation category
// 3. Rating
// 4. (Optional) Embedding cosine similarity when AI is available

const { query } = require('../db/pool');
const { getOnlineWingmates } = require('../db/redis');
const aiService = require('./ai');

// Tag mapping from situation categories to wingmate expertise tags
const CATEGORY_TAG_MAP = {
  'A confusing text or message':    ['mixed signals', 'texting', 'communication gaps'],
  'Mixed signals from someone':     ['mixed signals', 'reading emotions', 'uncertainty'],
  'A breakup or distance':          ['breakups', 'emotional distance', 'moving on'],
  'How to start a conversation':    ['conversation starter', 'first moves', 'confidence'],
  'Relationship tension':           ['conflict resolution', 'relationship clarity', 'tension'],
  'Friendship issue':               ['friendships', 'social dynamics', 'boundaries'],
  'Something else':                 [],
};

/**
 * Find the best Wingmate for a given seeker session.
 * Returns a Wingmate user object or null if none available.
 */
async function findMatch({ seekerId, category, situationText, genderPref }) {
  try {
    // 1. Get online wingmate IDs from Redis
    const onlineIds = await getOnlineWingmates(50);

    if (!onlineIds.length) {
      // No one online — return any available wingmate (offline matching)
      return findOfflineMatch({ seekerId, category, genderPref });
    }

    // 2. Build query — get online wingmates excluding the seeker themselves
    const relevantTags = CATEGORY_TAG_MAP[category] || [];

    let queryText = `
      SELECT
        u.id, u.alias, u.rating, u.rating_count,
        wp.tags, wp.bio, wp.session_count, wp.available,
        -- Tag overlap score (higher = better match)
        COALESCE(
          array_length(
            ARRAY(SELECT unnest(wp.tags) INTERSECT SELECT unnest($1::text[])),
            1
          ), 0
        ) AS tag_score
      FROM users u
      JOIN wingmate_profiles wp ON wp.user_id = u.id
      WHERE u.id = ANY($2::uuid[])
        AND u.id != $3
        AND wp.available = true
        AND (u.role = 'wingmate' OR u.role = 'both')
    `;

    const params = [relevantTags, onlineIds, seekerId];

    if (genderPref && genderPref !== 'Any') {
      queryText += ` AND u.gender_pref = $${params.length + 1}`;
      params.push(genderPref);
    }

    queryText += `
      ORDER BY
        tag_score DESC,
        u.rating DESC,
        wp.session_count ASC   -- prefer less-busy wingmates
      LIMIT 5
    `;

    const { rows } = await query(queryText, params);

    if (!rows.length) return findOfflineMatch({ seekerId, category, genderPref });

    // 3. If we have a situation text and multiple candidates, use AI to pick best
    if (situationText && rows.length > 1) {
      const bestMatch = await aiService.selectBestMatch(situationText, rows);
      return bestMatch || rows[0];
    }

    return rows[0];
  } catch (err) {
    console.error('Matching error:', err);
    return null;
  }
}

async function findOfflineMatch({ seekerId, category, genderPref }) {
  const relevantTags = CATEGORY_TAG_MAP[category] || [];
  let queryText = `
    SELECT u.id, u.alias, u.rating, u.rating_count, wp.tags, wp.bio, wp.session_count
    FROM users u
    JOIN wingmate_profiles wp ON wp.user_id = u.id
    WHERE u.id != $1
      AND wp.available = true
      AND (u.role = 'wingmate' OR u.role = 'both')
    ORDER BY
      COALESCE(array_length(ARRAY(SELECT unnest(wp.tags) INTERSECT SELECT unnest($2::text[])), 1), 0) DESC,
      u.rating DESC
    LIMIT 1
  `;
  const { rows } = await query(queryText, [seekerId, relevantTags]);
  return rows[0] || null;
}

/**
 * Mark a Wingmate as unavailable while in a session
 */
async function lockWingmate(wingmateId) {
  await query('UPDATE wingmate_profiles SET available = false WHERE user_id = $1', [wingmateId]);
}

/**
 * Mark a Wingmate as available again after session ends
 */
async function releaseWingmate(wingmateId) {
  await query('UPDATE wingmate_profiles SET available = true WHERE user_id = $1', [wingmateId]);
}

module.exports = { findMatch, lockWingmate, releaseWingmate };
