// server/src/socket.js
// All real-time communication: chat messages, presence, call signalling

const { Server } = require('socket.io');
const { verifySocketToken } = require('./middleware/auth');
const { query } = require('./db/pool');
const { setUserOnline, setUserOffline } = require('./db/redis');
const { generateChatInsight } = require('./services/ai');

// How often to generate AI insights during a conversation (every N messages)
const AI_INSIGHT_EVERY_N = 4;

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
    },
    pingTimeout: 60000,
  });

  // ── Auth middleware ─────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication required'));

    const payload = verifySocketToken(token);
    if (!payload) return next(new Error('Invalid token'));

    // Attach user to socket
    const { rows } = await query('SELECT id, alias, role FROM users WHERE id = $1', [payload.sub]);
    if (!rows.length) return next(new Error('User not found'));

    socket.user = rows[0];
    next();
  });

  // ── Connection ──────────────────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`[socket] connected: ${user.alias} (${user.id.slice(0, 8)})`);

    // Mark user online in Redis
    await setUserOnline(user.id, socket.id);

    // If wingmate, update DB availability
    if (user.role === 'wingmate' || user.role === 'both') {
      await query('UPDATE wingmate_profiles SET available = true WHERE user_id = $1', [user.id]);
    }

    // ── Join a session room ───────────────────────────────────────────────────
    socket.on('session:join', async ({ sessionId }) => {
      try {
        // Verify user belongs to this session
        const { rows } = await query(
          'SELECT * FROM sessions WHERE id = $1 AND (seeker_id = $2 OR wingmate_id = $2)',
          [sessionId, user.id]
        );
        if (!rows.length) {
          socket.emit('error', { message: 'Session not found or access denied' });
          return;
        }

        const session = rows[0];
        socket.join(`session:${sessionId}`);
        socket.currentSessionId = sessionId;

        // Notify the matched wingmate of the incoming request
        if (session.wingmate_id && session.wingmate_id !== user.id) {
          const wingmateSocketId = await getSocketIdForUser(session.wingmate_id);
          if (wingmateSocketId) {
            io.to(wingmateSocketId).emit('wingmate:request', {
              sessionId,
              category: session.category,
              situation: session.situation ? session.situation.slice(0, 150) : null,
            });
          }
        }

        // Activate session if both parties have joined
        const roomClients = await io.in(`session:${sessionId}`).fetchSockets();
        if (roomClients.length >= 2 && session.status === 'matching') {
          await query("UPDATE sessions SET status = 'active' WHERE id = $1", [sessionId]);
          io.to(`session:${sessionId}`).emit('session:active', { sessionId });
        }

        socket.emit('session:joined', { sessionId, status: session.status });
      } catch (err) {
        console.error('session:join error:', err);
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    // ── Send a chat message ────────────────────────────────────────────────────
    socket.on('message:send', async ({ sessionId, content }) => {
      try {
        if (!content || content.trim().length === 0) return;
        if (content.length > 2000) {
          socket.emit('error', { message: 'Message too long (max 2000 chars)' });
          return;
        }

        // Verify session membership
        const { rows: sessionRows } = await query(
          "SELECT seeker_id, wingmate_id FROM sessions WHERE id = $1 AND status = 'active'",
          [sessionId]
        );
        if (!sessionRows.length) {
          socket.emit('error', { message: 'Session not active' });
          return;
        }

        const session = sessionRows[0];
        const senderRole = session.seeker_id === user.id ? 'seeker' : 'wingmate';

        // Save to DB
        const { rows } = await query(
          `INSERT INTO messages (session_id, sender_id, sender_role, content)
           VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
          [sessionId, user.id, senderRole, content.trim()]
        );

        const message = {
          id: rows[0].id,
          sessionId,
          senderId: user.id,
          senderAlias: user.alias,
          senderRole,
          content: content.trim(),
          createdAt: rows[0].created_at,
        };

        // Broadcast to everyone in the session room (including sender)
        io.to(`session:${sessionId}`).emit('message:new', message);

        // Periodically generate AI insights
        const { rows: countRows } = await query(
          "SELECT COUNT(*) AS cnt FROM messages WHERE session_id = $1 AND sender_role != 'ai_note'",
          [sessionId]
        );
        const msgCount = parseInt(countRows[0].cnt, 10);

        if (msgCount > 0 && msgCount % AI_INSIGHT_EVERY_N === 0) {
          generateAndEmitInsight(io, sessionId, user.id).catch(console.error);
        }
      } catch (err) {
        console.error('message:send error:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ── Typing indicator ──────────────────────────────────────────────────────
    socket.on('typing:start', ({ sessionId }) => {
      socket.to(`session:${sessionId}`).emit('typing:start', { userId: user.id, alias: user.alias });
    });

    socket.on('typing:stop', ({ sessionId }) => {
      socket.to(`session:${sessionId}`).emit('typing:stop', { userId: user.id });
    });

    // ── Call signalling (WebRTC) ──────────────────────────────────────────────
    socket.on('call:request', ({ sessionId }) => {
      socket.to(`session:${sessionId}`).emit('call:incoming', {
        from: { id: user.id, alias: user.alias },
        sessionId,
      });
    });

    socket.on('call:accept', ({ sessionId }) => {
      socket.to(`session:${sessionId}`).emit('call:accepted', { by: user.alias });
    });

    socket.on('call:decline', ({ sessionId }) => {
      socket.to(`session:${sessionId}`).emit('call:declined', { by: user.alias });
    });

    socket.on('call:end', ({ sessionId }) => {
      io.to(`session:${sessionId}`).emit('call:ended', { by: user.alias });
      query('UPDATE sessions SET call_active = false WHERE id = $1', [sessionId]).catch(console.error);
    });

    // WebRTC signalling relay (offer/answer/ICE candidates)
    socket.on('webrtc:offer', ({ sessionId, offer }) => {
      socket.to(`session:${sessionId}`).emit('webrtc:offer', { offer, from: user.id });
    });

    socket.on('webrtc:answer', ({ sessionId, answer }) => {
      socket.to(`session:${sessionId}`).emit('webrtc:answer', { answer, from: user.id });
    });

    socket.on('webrtc:ice', ({ sessionId, candidate }) => {
      socket.to(`session:${sessionId}`).emit('webrtc:ice', { candidate, from: user.id });
    });

    // ── Wingmate decline session request ─────────────────────────────────────
    socket.on('wingmate:decline', ({ sessionId }) => {
      socket.to(`session:${sessionId}`).emit('wingmate:declined', { sessionId });
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`[socket] disconnected: ${user.alias}`);
      await setUserOffline(user.id);

      // Mark offline (but keep available — they may reconnect)
      await query('UPDATE users SET is_online = false WHERE id = $1', [user.id]).catch(console.error);

      // Notify session partner
      if (socket.currentSessionId) {
        socket.to(`session:${socket.currentSessionId}`).emit('partner:offline', {
          alias: user.alias,
        });
      }
    });
  });

  return io;
}

// Look up a user's socket ID from Redis presence store
async function getSocketIdForUser(userId) {
  try {
    const { client: redis } = require('./db/redis');
    return await redis.hGet('online_users', userId);
  } catch {
    return null;
  }
}

// Generate an AI insight and emit it to the session room
async function generateAndEmitInsight(io, sessionId, userId) {
  try {
    const { rows } = await query(
      "SELECT sender_role, content FROM messages WHERE session_id = $1 AND sender_role != 'ai_note' ORDER BY created_at DESC LIMIT 10",
      [sessionId]
    );

    const insight = await generateChatInsight(rows.reverse());
    if (!insight) return;

    // Save as an AI note message
    await query(
      "INSERT INTO messages (session_id, sender_id, sender_role, content) VALUES ($1,$2,'ai_note',$3)",
      [sessionId, userId, insight]
    );

    io.to(`session:${sessionId}`).emit('ai:insight', { text: insight, sessionId });
  } catch (err) {
    console.error('AI insight error:', err.message);
  }
}

module.exports = { initSocket };
