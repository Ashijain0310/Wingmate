# Wingmate — Deploy to Vercel (No Technical Knowledge Needed)

## What you need (all free)

| Service | What it's for | Cost |
|---|---|---|
| GitHub | Store your code online | Free |
| Vercel | Host your app | Free |
| Neon | PostgreSQL database | Free |
| Upstash | Redis (real-time presence) | Free |
| Pusher | Real-time chat & calls | Free |
| Anthropic | Claude AI | Pay per use (~$0.01/session) |

---

## Step 1 — Get your free database (Neon)

1. Go to **neon.tech** → Sign up free
2. Click **"Create Project"** → name it `wingmate`
3. Copy the **Connection string** — looks like:
   ```
   postgresql://user:password@ep-something.us-east-2.aws.neon.tech/wingmate?sslmode=require
   ```
4. Save it — this is your `DATABASE_URL`

---

## Step 2 — Get your free Redis (Upstash)

1. Go to **upstash.com** → Sign up free
2. Click **"Create Database"** → name it `wingmate` → pick closest region
3. Click your database → copy **"Redis URL"** — looks like:
   ```
   rediss://default:password@something.upstash.io:6379
   ```
4. Save it — this is your `REDIS_URL`

---

## Step 3 — Get your free real-time service (Pusher)

1. Go to **pusher.com** → Sign up free
2. Click **"Channels"** → **"Create app"**
3. Name: `wingmate`, Cluster: pick closest to you (e.g. `ap2` for Asia)
4. Click **"App Keys"** tab — copy all 4 values:
   - `app_id` → this is your `PUSHER_APP_ID`
   - `key`    → this is your `PUSHER_KEY` and `REACT_APP_PUSHER_KEY`
   - `secret` → this is your `PUSHER_SECRET`
   - `cluster`→ this is your `PUSHER_CLUSTER` and `REACT_APP_PUSHER_CLUSTER`

---

## Step 4 — Get your Anthropic API key

1. Go to **console.anthropic.com** → Sign up or log in
2. Click **"API Keys"** → **"Create Key"** → name it `wingmate`
3. Copy the key — starts with `sk-ant-`
4. Save it — this is your `ANTHROPIC_API_KEY`

---

## Step 5 — Put your code on GitHub

1. Go to **github.com** → Sign up or log in
2. Click the **+** button top right → **"New repository"**
3. Name: `wingmate` → click **"Create repository"**
4. You'll see a page with instructions. Click **"uploading an existing file"**
5. Drag the entire contents of your `wingmate-vercel` folder into the upload area
6. Click **"Commit changes"**

---

## Step 6 — Deploy on Vercel

1. Go to **vercel.com** → Click **"Sign up"** → choose **"Continue with GitHub"**
2. Click **"Add New Project"**
3. Find your `wingmate` repo → click **"Import"**
4. Vercel auto-detects everything. Click **"Environment Variables"**
5. Add each of these one by one (Name = left column, Value = right column):

| Name | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string |
| `REDIS_URL` | Your Upstash Redis URL |
| `JWT_SECRET` | Any long random text (e.g. `my-super-secret-wingmate-key-2024`) |
| `ANTHROPIC_API_KEY` | Your `sk-ant-...` key |
| `PUSHER_APP_ID` | From Pusher App Keys |
| `PUSHER_KEY` | From Pusher App Keys |
| `PUSHER_SECRET` | From Pusher App Keys |
| `PUSHER_CLUSTER` | e.g. `ap2` |
| `REACT_APP_PUSHER_KEY` | Same as `PUSHER_KEY` |
| `REACT_APP_PUSHER_CLUSTER` | Same as `PUSHER_CLUSTER` |

6. Click **"Deploy"** — wait ~2 minutes

7. Vercel gives you a live URL like: `https://wingmate-abc123.vercel.app` 🎉

---

## Step 7 — Set up the database (one time only)

After deploy, you need to create the database tables. The easiest way:

1. On Vercel dashboard → your project → **"Functions"** tab
2. Or — use the Neon dashboard's SQL editor:
   - Go to neon.tech → your project → **"SQL Editor"**
   - Copy the contents of `api/_lib/migrate.js` — just the big SQL string between the backticks
   - Paste it into the SQL editor → click **"Run"**

---

## Step 8 — Add demo Wingmates (optional but recommended)

In the Neon SQL Editor, run this to create 5 demo Wingmates for testing:

```sql
-- Creates demo Wingmate accounts
INSERT INTO users (alias, email_hash, provider, password_hash, role, rating, rating_count)
VALUES
  ('Sage',  md5('sage@demo'),  'email', '$2a$12$demo', 'wingmate', 4.9, 48),
  ('River', md5('river@demo'), 'email', '$2a$12$demo', 'wingmate', 4.8, 31),
  ('Nova',  md5('nova@demo'),  'email', '$2a$12$demo', 'wingmate', 5.0, 62)
ON CONFLICT DO NOTHING;

INSERT INTO wingmate_profiles (user_id, tags, bio, session_count, available)
SELECT id, ARRAY['mixed signals','breakups'], 'Here to help with clarity.', 10, true
FROM users WHERE alias IN ('Sage','River','Nova') AND role='wingmate'
ON CONFLICT DO NOTHING;
```

---

## Your app is live!

Share your Vercel URL with anyone. They can:
- Sign up with email
- Describe their situation
- Get matched with a Wingmate
- Chat in real-time
- Switch to a voice call
- Get AI-powered insights

---

## Updating your app later

Whenever you make changes:
1. Re-upload your files to GitHub (drag & drop again)
2. Vercel automatically re-deploys — usually takes ~60 seconds

---

## Cost estimate

| Usage | Monthly Cost |
|---|---|
| 100 users/month | ~$0 (all free tiers) |
| 1,000 users/month | ~$5-10 (Pusher paid plan) |
| 10,000 users/month | ~$50 (Pusher + Neon + Anthropic) |

---

## Need help?

If anything goes wrong, take a screenshot of the error and share it.
Common fixes:
- **White screen** → check Vercel "Functions" logs for errors
- **Can't sign up** → DATABASE_URL is wrong or migration wasn't run
- **No real-time** → PUSHER_KEY or PUSHER_SECRET is wrong
- **AI not working** → ANTHROPIC_API_KEY is wrong or has no credits
