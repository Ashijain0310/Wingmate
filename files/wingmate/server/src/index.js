// server/src/index.js
require('dotenv').config();

const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

const { connectRedis }  = require('./db/redis');
const { initSocket }    = require('./socket');
const { startCleanupWorker } = require('./workers/cleanup');

const authRoutes     = require('./routes/auth');
const sessionRoutes  = require('./routes/sessions');
const aiRoutes       = require('./routes/ai');
const callRoutes     = require('./routes/calls');
const userRoutes     = require('./routes/users');

const app    = express();
const server = http.createServer(app);

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));

// Global rate limit — 200 requests / 15 min per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/ai',       aiRoutes);
app.use('/api/calls',    callRoutes);
app.use('/api/users',    userRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  // Connect Redis
  await connectRedis();

  // Init Socket.io
  initSocket(server);

  // Start background cleanup worker
  startCleanupWorker();

  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`\n✓ Wingmate server running on http://localhost:${PORT}`);
    console.log(`  Env: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  DB:  ${process.env.DATABASE_URL ? 'configured' : '⚠ DATABASE_URL not set'}`);
    console.log(`  AI:  ${process.env.ANTHROPIC_API_KEY ? 'configured' : '⚠ ANTHROPIC_API_KEY not set'}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = { app, server };
