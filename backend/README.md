# LEVELED Backend — Phase 1

WHOOP OAuth integration, encrypted token storage, and the 873-exercise library.

**Stack:** Node.js + Express 5 · PostgreSQL · Prisma · deployed on Railway.

---

## Endpoint reference

| Method | Path                    | Purpose                                                           |
|-------:|-------------------------|-------------------------------------------------------------------|
| GET    | `/health`               | Liveness probe — `{ status: "ok", timestamp }`. Used by Railway. |
| GET    | `/auth/whoop/start`     | Generates OAuth state, redirects user to WHOOP authorize URL.    |
| GET    | `/auth/whoop/callback`  | Verifies state, exchanges code, encrypts + persists tokens.      |
| POST   | `/webhooks/whoop`       | WHOOP webhook receiver (Phase 1: HMAC verify + log only).        |

---

## Prerequisites

You need these installed locally on macOS:

1. **Node.js 20+** — you have v26, you're good.
2. **PostgreSQL** — recommended: [Postgres.app](https://postgresapp.com/) (drag-to-Applications, click *Initialize*).
3. **mkcert** — for the local HTTPS cert (WHOOP rejects HTTP redirect URIs).
   ```bash
   brew install mkcert nss
   mkcert -install      # installs a local CA into your keychain
   ```

---

## Quick start (after first-time setup below)

```bash
cd backend
npm run dev            # starts server on https://localhost:3000
```

---

## First-time setup

### 1. Install dependencies

```bash
cd backend
npm install
npx prisma generate
```

### 2. Create the local Postgres database

After installing Postgres.app and starting it (you'll see an elephant in your menu bar):

```bash
# From Postgres.app's "Open psql" or directly in terminal once Postgres.app
# has added /Applications/Postgres.app/Contents/Versions/latest/bin to PATH:
createdb leveled
```

If `createdb` isn't on your PATH, open Postgres.app → click the database → it'll open a psql shell, then run `CREATE DATABASE leveled;`.

### 3. Generate the local HTTPS cert

WHOOP requires an HTTPS redirect URI. We use mkcert to generate a cert your browser will trust.

```bash
mkdir -p certs
cd certs
mkcert localhost
cd ..
```

This creates `certs/localhost.pem` (cert) and `certs/localhost-key.pem` (key). Both are gitignored.

### 4. Generate encryption keys

```bash
npm run keys:generate
```

Output looks like:

```
TOKEN_ENCRYPTION_KEY=<64 hex chars>
SESSION_SECRET=<64 hex chars>
```

Copy these into your `.env` file (see next step).

### 5. Fill in `.env`

```bash
cp .env.example .env
```

Open `.env` and fill in:

- `DATABASE_URL` — `postgresql://<your_mac_username>@localhost:5432/leveled` for Postgres.app (no password by default), or whatever your local Postgres setup uses.
- `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET` — from the [WHOOP Developer Dashboard](https://developer.whoop.com/).
- `WHOOP_REDIRECT_URI` — should already be `https://localhost:3000/auth/whoop/callback`. Make sure this exact URL is also added in your WHOOP app's redirect URIs.
- `WHOOP_WEBHOOK_SECRET` — from the WHOOP dashboard (webhook settings).
- `TOKEN_ENCRYPTION_KEY`, `SESSION_SECRET` — paste from step 4.

### 6. Run the migration

```bash
npm run db:migrate
```

Prisma will prompt you to name the migration (e.g., `init`). It will then create the three tables in your local Postgres and generate the client.

### 7. Seed the exercise library

```bash
npm run db:seed
```

Expected output:

```
[seed] Read 873 exercises from data/exercises_leveled.json
[seed] 100/873...
[seed] 200/873...
...
Seeded 873 exercises
```

Verify in psql:

```sql
SELECT COUNT(*) FROM exercises;
-- 873

SELECT body_parts, COUNT(*) FROM exercises, unnest(body_parts) AS body_parts GROUP BY 1;
-- 5 rows: Arms, Back, Chest, Core, Legs
```

### 8. Start the server

```bash
npm run dev
```

Console should show:

```
[leveled] HTTPS listening on https://localhost:3000
```

Smoke-test:

```bash
curl -k https://localhost:3000/health
# {"status":"ok","timestamp":"..."}
```

(`-k` because the cert is self-signed; browsers will trust it once `mkcert -install` is done.)

### 9. Test the WHOOP OAuth flow

1. Open `https://localhost:3000/auth/whoop/start` in your browser.
2. WHOOP login page appears → log in → approve the scopes.
3. You're redirected back to `https://localhost:3000/auth/whoop/callback` and see a "WHOOP connected" page.
4. Verify in psql:
   ```sql
   SELECT user_id, whoop_user_id, expires_at, length(access_token) AS at_len, length(refresh_token) AS rt_len
   FROM whoop_connections;
   ```
   `access_token` and `refresh_token` are `bytea` — they will display as `\x...` hex, NOT as plaintext. That's correct: they're AES-256-GCM encrypted.

---

## Security model

- **Tokens at rest:** AES-256-GCM. Each token (access, refresh) gets its **own 12-byte IV** (`access_token_iv`, `refresh_token_iv`). Never reuse a GCM IV under the same key — it breaks both confidentiality and authenticity.
- **Encryption key:** `TOKEN_ENCRYPTION_KEY` is a 32-byte hex string. **Never commit it.** If it leaks, all stored tokens must be considered compromised; rotate by re-running the OAuth flow.
- **Sessions:** `express-session` with in-memory store, 10-minute cookie lifetime — long enough for the OAuth redirect roundtrip, no longer. Cookies are `httpOnly`, `sameSite=lax`, and `secure` on HTTPS.
- **Rate limits:** all `/auth/*` endpoints are limited to 30 requests per IP per 15 min.
- **Webhook signatures:** verified with `crypto.timingSafeEqual` to prevent timing attacks.
- **Logging:** access/refresh tokens are never logged. Use `crypto.mask()` if you must reference one in a log line.

---

## Project structure

```
backend/
├── src/
│   ├── server.js               # Express 5 entry point
│   ├── routes/
│   │   ├── health.js           # GET /health
│   │   ├── auth.js             # WHOOP OAuth start + callback
│   │   └── webhooks.js         # WHOOP webhook receiver (stub)
│   ├── lib/
│   │   ├── crypto.js           # AES-256-GCM encrypt/decrypt
│   │   └── whoop.js            # WHOOP API client + token refresh
│   └── db/
│       ├── prisma.js           # Shared PrismaClient instance
│       ├── seed.js             # Imports exercises_leveled.json
│       └── prisma/
│           └── schema.prisma   # users, whoop_connections, exercises
├── certs/                       # mkcert TLS files (gitignored)
├── .env                         # Local secrets (gitignored)
├── .env.example
└── package.json
```

The `data/` folder lives at the repo root, alongside `backend/`. The seed script reads from `../data/exercises_leveled.json`.

---

## npm scripts

| Script                  | What it does                                                |
|-------------------------|-------------------------------------------------------------|
| `npm run dev`           | Start server with nodemon autoreload                        |
| `npm start`             | Start server (no autoreload — used by Railway)              |
| `npm run db:migrate`    | Run Prisma migrations in dev mode (creates new migrations)  |
| `npm run db:migrate:deploy` | Apply existing migrations (used by Railway on deploy)   |
| `npm run db:seed`       | Idempotently upsert all 873 exercises                       |
| `npm run db:generate`   | Regenerate Prisma client after schema changes               |
| `npm run keys:generate` | Print fresh `TOKEN_ENCRYPTION_KEY` and `SESSION_SECRET`     |

---

## Deployment (Railway)

High-level: push to GitHub → Railway auto-deploys.

Detailed walkthrough happens with Claude in chat — covers connecting Railway to `github.com/Justinpz/LEVELED`, provisioning a Postgres service, setting environment variables, and updating the WHOOP redirect URI to point at the Railway URL.

In production:
- `NODE_ENV=production` — server listens on plain HTTP (Railway terminates TLS for you).
- `DATABASE_URL` — provided by Railway's Postgres service.
- `WHOOP_REDIRECT_URI` — must be updated to your Railway URL and re-registered with WHOOP.
- Run `npm run db:migrate:deploy && npm run db:seed` as part of the deploy.

---

## Phase 1 ↔ Phase 2 handoff

What's done in Phase 1:
- ✅ WHOOP OAuth (authorization code grant)
- ✅ Encrypted token storage
- ✅ Exercise library (873 rows, GIN-indexed body_parts)
- ✅ Webhook signature verification (stub)

What's deferred to Phase 2:
- Real user authentication (currently uses placeholder users keyed by WHOOP email)
- Postgres-backed session store (currently in-memory — fine for OAuth state, not for real auth)
- Webhook event processing (currently logs and acks; will sync recoveries / sleeps / cycles / workouts)
- WHOOP API sync scheduler + token refresh on expiry
- React Native + Expo mobile app
