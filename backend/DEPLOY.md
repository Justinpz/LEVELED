# Deploying the LEVELED backend (Railway)

Phase 1 (WHOOP OAuth + exercises) is already live on Railway. This guide takes the
same service to **Phase 2** (game systems). The deploy is self-migrating: the start
command runs `prisma migrate deploy` before booting, so the Phase 2 tables are
created automatically on first boot — no manual SQL.

## What's already wired into the repo

| Piece | Where |
|---|---|
| Phase 2 migration (all game tables, additive ALTERs on `users`/`exercises`) | `src/db/prisma/migrations/20260708120000_phase2_game_systems/` |
| Self-migrating start command | `npm run deploy:start` (`prisma migrate deploy && node src/server.js`) |
| Railway service config (start command, `/health` healthcheck, restart policy) | `railway.json` |
| Prisma client generation on install | `postinstall: prisma generate` |
| CORS for browser/Expo-web clients | `src/server.js` (lock down via `CORS_ORIGIN`) |

## Steps

### 1. Merge or point Railway at this branch
Railway auto-deploys the connected branch. Either merge PR #2 into `main`, or set the
service's deploy branch to `claude/higgsfield-asset-spec-N3lJr`. The service's
**root directory must be `/backend`** (as in Phase 1).

### 2. Set environment variables (Railway → service → Variables)
Required beyond Phase 1's existing vars:

| Var | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your Anthropic API key (AI program builder) |
| `ANTHROPIC_MODEL` | latest Claude model id |
| `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY` | keep Phase 1 values (or `npm run keys:generate`) |
| `CORS_ORIGIN` (optional) | your client origin; defaults to `*` |

`DATABASE_URL` and `PORT` are provided by Railway already.

### 3. Deploy
Push/merge → Railway builds → `migrate deploy` applies `phase2_game_systems` →
server boots → healthcheck `/health` goes green.

### 4. One-time seed (after first Phase 2 boot)

**No CLI / no laptop needed — from the Railway app or any browser/HTTP client:**
1. Railway → service → **Variables** → add `ADMIN_SEED_KEY` = any random string.
   Saving triggers a redeploy (needed so the server picks up the new var).
2. Once that redeploy is green, call:
   ```
   POST https://<your-service>.up.railway.app/admin/seed
   Header: x-admin-key: <the value you just set>
   ```
   From a phone with no terminal, ask whoever has shell/API access (e.g. this
   session) to run the `curl` below with the key — no Railway CLI required on
   your end, just the one variable:
   ```bash
   curl -X POST https://<your-service>.up.railway.app/admin/seed \
     -H "x-admin-key: <the value you set>"
   ```
   Response: `{"ok":true,"exercises":{"count":873},"gear":{"count":124},"challenges":{"count":12,...}}`
3. Optional: unset `ADMIN_SEED_KEY` afterward (or rotate it) to close the endpoint again.
   All three seeds are idempotent upserts — safe to call more than once regardless.

**With Railway CLI access instead:**
```bash
railway run --service <backend-service> npm run db:seed:all
# equivalently: DATABASE_URL=<prod-url> npm run db:seed:all
```

Either path seeds: 873 exercises (with the 70/30 XP fields), 124 gear items, 12 challenges.

Optional AI starter library (needs the Anthropic vars):
```bash
railway run --service <backend-service> npm run ai:starters
# review data/starter_programs.json, then load it
```

### 5. Verify

```bash
BASE=https://<your-service>.up.railway.app
curl $BASE/health                      # {"status":"ok",...}
curl $BASE/game/exercises?take=1      # 1 exercise incl. primaryBodyParts
curl $BASE/game/shop -H 'x-user-id: <uuid>'   # 124 items with lock state
curl $BASE/challenges/daily            # today's challenge
```

### 6. Point the app at it

```bash
cd mobile
EXPO_PUBLIC_API_URL=$BASE npm start    # mock mode switches off automatically
```

## Notes
- The migration only **adds** — no existing Phase 1 data is touched.
- `migrate deploy` is a no-op when there's nothing new; every boot is safe.
- No user rows yet? The API falls back to the first user row; create one via the
  Phase 1 flow or insert a row in `users` — real auth is a later pass.
