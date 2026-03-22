// api/_lib/auth.js
const jwt  = require('jsonwebtoken');
const { query } = require('./db');

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// Call at the top of any serverless function that needs auth
// Returns the user object or sends a 401 and returns null
async function requireAuth(req, res) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return null;
  }
  try {
    const token   = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query(
      'SELECT id, alias, role FROM users WHERE id = $1',
      [payload.sub]
    );
    if (!rows.length) {
      res.status(401).json({ error: 'User not found' });
      return null;
    }
    return rows[0];
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

// Apply CORS headers — call at the very start of every handler
function cors(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  // Return true if this was a preflight — caller should return immediately
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { signToken, requireAuth, cors };
