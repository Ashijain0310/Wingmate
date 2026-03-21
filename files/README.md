# Wingmate — Full Stack App

> Express yourself, truly and safely. Real human perspective, supported by AI.

---

## What's built

| Layer | Tech | Status |
|---|---|---|
| Frontend | React 18 + React Router | ✅ Complete |
| Backend API | Node.js + Express | ✅ Complete |
| Real-time chat | Socket.io | ✅ Complete |
| Database | PostgreSQL 16 | ✅ Complete |
| Cache / Presence | Redis 7 | ✅ Complete |
| Authentication | JWT + bcrypt + OAuth-ready | ✅ Complete |
| Matching engine | Tag overlap + AI-assisted | ✅ Complete |
| AI features | Claude API (claude-sonnet-4-6) | ✅ Complete |
| Voice calls | WebRTC (peer-to-peer) | ✅ Complete |
| Voice calls (fallback) | Twilio Programmable Voice | ✅ Configured |
| Containerisation | Docker + Docker Compose | ✅ Complete |

---

## Quick Start (Docker — recommended)

### 1. Clone and configure

```bash
git clone <your-repo> wingmate
cd wingmate

# Create environment file
cp server/.env.example server/.env
```

### 2. Fill in your API keys in `server/.env`

```env
ANTHROPIC_API_KEY=sk-ant-...        # Required — get from console.anthropic.com
JWT_SECRET=any-long-random-string   # Required — generate with: openssl rand -hex 32

# Optional (voice calls still work via WebRTC without these)
TWILIO_ACCOUNT_SID=AC...
TWILIO_API_KEY=SK...
TWILIO_API_SECRET=...
```

### 3. Start everything

```bash
docker-compose up --build
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- API server on port 4000 (runs migrations automatically)
- React frontend on port 3000

### 4. Seed demo Wingmates

```bash
docker-compose exec server node src/db/seed.js
```

### 5. Open the app

```
http://localhost:3000
```

---

## Local Development (without Docker)

### Prerequisites
- Node.js 20+
- PostgreSQL 16 running locally
- Redis running locally

### Setup

```bash
# Install all dependencies
npm run install:all

# Configure environment
cp server/.env.example server/.env
# Edit server/.env with your local DATABASE_URL, ANTHROPIC_API_KEY, etc.

# Run database migrations
cd server && node src/db/migrate.js

# Seed demo Wingmates
node src/db/seed.js

# Start both server and client
cd ..
npm run dev
```

Server runs on `http://localhost:4000`  
Client runs on `http://localhost:3000`

---

## Architecture

```
Client (React)
    │
    ├── REST API  ──→  Express routes (auth, sessions, ai, calls)
    ├── WebSocket ──→  Socket.io (real-time chat, typing, call signalling)
    └── WebRTC   ──→  Peer-to-peer audio (signalled via Socket.io)
                          │
                    PostgreSQL  ←  sessions, users, messages, insights
                    Redis       ←  presence, session cache, match queue
                    Claude API  ←  AI features (rephrase, insights, matching)
                    Twilio      ←  fallback for voice calls
```

---

## API Reference

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/signin` | Sign in, get JWT |
| POST | `/api/auth/google` | Google OAuth |
| GET  | `/api/auth/me` | Get current user |

### Sessions
| Method | Path | Description |
|---|---|---|
| POST | `/api/sessions` | Start session + match Wingmate |
| GET  | `/api/sessions/:id` | Get session info |
| GET  | `/api/sessions/:id/messages` | Message history |
| POST | `/api/sessions/:id/end` | End session + trigger AI insights |

### AI
| Method | Path | Description |
|---|---|---|
| POST | `/api/ai/rephrase` | Rephrase situation text |
| POST | `/api/ai/suggest` | Chat message suggestions |
| POST | `/api/ai/insight` | Real-time chat insight |
| GET  | `/api/ai/insights` | Get saved insights |
| DELETE | `/api/ai/insights/:id` | Delete an insight |

### Calls
| Method | Path | Description |
|---|---|---|
| POST | `/api/calls/token` | Get Twilio token for call room |
| POST | `/api/calls/start` | Notify call started |
| POST | `/api/calls/end` | Notify call ended |

---

## Socket Events

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `session:join` | `{sessionId}` | Join session room |
| `message:send` | `{sessionId, content}` | Send chat message |
| `typing:start` | `{sessionId}` | Notify typing |
| `typing:stop` | `{sessionId}` | Notify stopped typing |
| `call:request` | `{sessionId}` | Initiate call |
| `call:accept` | `{sessionId}` | Accept incoming call |
| `call:decline` | `{sessionId}` | Decline call |
| `call:end` | `{sessionId}` | End call |
| `webrtc:offer` | `{sessionId, offer}` | WebRTC offer |
| `webrtc:answer` | `{sessionId, answer}` | WebRTC answer |
| `webrtc:ice` | `{sessionId, candidate}` | ICE candidate |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `message:new` | Message object | New chat message |
| `typing:start` | `{userId, alias}` | Partner is typing |
| `typing:stop` | `{userId}` | Partner stopped |
| `ai:insight` | `{text}` | AI generated a note |
| `call:incoming` | `{from, sessionId}` | Incoming call request |
| `call:accepted` | `{by}` | Call was accepted |
| `call:declined` | `{by}` | Call was declined |
| `call:ended` | `{by}` | Call ended |
| `session:active` | `{sessionId}` | Both parties joined |
| `partner:offline` | `{alias}` | Partner disconnected |

---

## Privacy & Security

- Emails are **SHA-256 hashed** before storage — never stored in plain text
- Conversations are **deleted** after a session ends (10 second grace period for AI insight generation)
- JWT tokens expire after 7 days
- All API routes rate-limited
- Sessions have a **24-hour TTL** — auto-deleted even if never explicitly ended
- Voice calls use **WebRTC peer-to-peer** — audio does not pass through the server

---

## Production Checklist

- [ ] Set strong `JWT_SECRET` (32+ random characters)
- [ ] Set `NODE_ENV=production`
- [ ] Add TURN server credentials in `client/src/lib/webrtc.js`
- [ ] Configure real Google OAuth (replace stub in `server/src/routes/auth.js`)
- [ ] Add Twilio credentials for fallback voice
- [ ] Set up SSL/TLS (required for WebRTC microphone access)
- [ ] Add `pg_cron` job to clean expired sessions nightly
- [ ] Configure `CLIENT_URL` to your actual domain
