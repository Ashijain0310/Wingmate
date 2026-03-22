// dev-server.js
// Local development server that mimics Vercel's serverless function routing
// Run with: node dev-server.js
// Requires: npm install express dotenv

require('dotenv').config({ path: '.env.local' });

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// CORS for local dev
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Dynamically load and route Vercel serverless functions
// Maps /api/xxx/yyy to api/xxx/[action].js or api/xxx/[...params].js

function loadHandler(filePath) {
  delete require.cache[require.resolve(filePath)];
  const mod = require(filePath);
  return mod.default || mod;
}

function findApiHandler(urlPath) {
  // Remove /api prefix and split
  const parts = urlPath.replace(/^\/api\//, '').split('/').filter(Boolean);
  const apiDir = path.join(__dirname, 'api');

  // Try exact match first: api/health.js
  if (parts.length === 0) return null;

  const exactPath = path.join(apiDir, ...parts) + '.js';
  if (fs.existsSync(exactPath)) return { file: exactPath, params: {} };

  // Try [action] pattern: api/auth/[action].js
  if (parts.length >= 2) {
    const actionFile = path.join(apiDir, parts[0], '[action].js');
    if (fs.existsSync(actionFile)) {
      return { file: actionFile, params: { action: parts[1], ...buildSubParams(parts.slice(2)) } };
    }
  }

  // Try [...params] pattern: api/sessions/[...params].js
  if (parts.length >= 1) {
    const catchAllFile = path.join(apiDir, parts[0], '[...params].js');
    if (fs.existsSync(catchAllFile)) {
      return { file: catchAllFile, params: { params: parts.slice(1) } };
    }
  }

  // Try root [action]: api/[action].js
  if (parts.length >= 1) {
    const rootFile = path.join(apiDir, '[action].js');
    if (fs.existsSync(rootFile)) {
      return { file: rootFile, params: { action: parts[0] } };
    }
  }

  // Nested: api/ai/insights/[id].js
  if (parts.length >= 3) {
    const nestedFile = path.join(apiDir, parts[0], parts[1], '[id].js');
    if (fs.existsSync(nestedFile)) {
      return { file: nestedFile, params: { id: parts[2] } };
    }
  }

  return null;
}

function buildSubParams(parts) {
  if (parts.length === 0) return {};
  if (parts.length === 1) return { insightId: parts[0] };
  return {};
}

app.all('/api/*', async (req, res) => {
  const match = findApiHandler(req.path);
  if (!match) return res.status(404).json({ error: `No handler for ${req.path}` });

  // Inject query params from path matching
  req.query = { ...req.query, ...match.params };

  try {
    const handler = loadHandler(match.file);
    await handler(req, res);
  } catch (err) {
    console.error(`[${req.path}]`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Serve React build if available, otherwise proxy hint
const buildDir = path.join(__dirname, 'client', 'build');
if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir));
  app.get('*', (req, res) => res.sendFile(path.join(buildDir, 'index.html')));
} else {
  app.get('/', (req, res) => res.json({
    message: 'API server running. Start React separately: cd client && npm start',
    api: 'http://localhost:3001/api',
  }));
}

const PORT = process.env.DEV_PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✓ Dev server running on http://localhost:${PORT}`);
  console.log(`  API: http://localhost:${PORT}/api/health`);
  console.log(`\n  To run React: cd client && REACT_APP_API_URL=http://localhost:${PORT}/api npm start\n`);
});
