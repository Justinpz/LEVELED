# LEVELED Phase 2 — Game Loop (Warrior MVP)

Stands up the core *workouts → growth* loop plus suggested programs, an AI program
builder, and the challenge (special-task) system. Single Warrior class; 8-bit art layer
is produced separately. See the master doc Parts 2–18 for the design.

## What's here

| Area | Files |
|---|---|
| XP engine (pure) | `src/lib/xp.js` — 100 pts/exercise, 70/30 split, curved thresholds, Warrior bonuses |
| Game API | `src/routes/game.js` — progress, workouts/log, exercises, shop, gear buy/equip |
| Programs + AI builder | `src/routes/programs.js`, `src/services/aiBuilder.js` |
| Challenges | `src/routes/challenges.js`, `src/services/challenges.js`, `data/challenges.json` |
| Schema | `src/db/prisma/schema.prisma` — BodyPartProgress, GearItem, UserGear, Program/Day/Exercise, WorkoutSession/LoggedSet, Challenge/UserChallenge, Title/UserTitle, Vehicle/UserVehicle; Exercise + primary/secondaryBodyParts |
| Seeds | `src/db/seed.js` (exercises), `src/db/seed_gear.js`, `src/db/seed_challenges.js` |
| Starter library | `src/scripts/generate_starter_programs.js` → `data/starter_programs.json` |

## Endpoints

```
GET  /game/progress                     5 body-part tracks (level/xp/points)
POST /game/workouts/log                 log a session → XP tally + level-ups
GET  /game/exercises?bodyPart=&...      exercise library (filters)
GET  /game/shop                         gear by slot/tier + locked/owned state
POST /game/gear/:id/buy                 spend slot points
POST /game/gear/:id/equip               equip an owned item

GET  /programs                          starters + your programs
GET  /programs/:id                      full program (days + exercises)
POST /programs                          save a built program
POST /programs/ai-generate              Claude builds a program from goals
POST /programs/ai-validate              Claude critiques a workout's structure

GET  /challenges/daily                  today's challenge
GET  /challenges/weekly                 this week's challenge
POST /challenges/:id/complete           award reward to tagged body part(s)
```

Auth is not built yet — the acting user is `x-user-id` header, else the first user row.
Swap `resolveUser()` for real auth in the auth-hardening pass.

## Required env

| Var | For |
|---|---|
| `DATABASE_URL` | Postgres (migrate + seed + all DB routes) |
| `ANTHROPIC_API_KEY` | AI builder (`/programs/ai-*`, starter generation) |
| `ANTHROPIC_MODEL` | AI model id — set to the latest Claude model |
| `GEAR_DB` (optional) | path to `gear_database.json` if not the sibling LEVELED_Images repo |

## Run order

```bash
cd backend
npm install                       # pulls @anthropic-ai/sdk
python3 ../scripts/transform_exercises.py   # regenerate exercises_leveled.json (70/30)
npm run db:migrate -- --name phase2_game_systems
npm run db:seed:all               # exercises + gear + challenges
npm run ai:starters               # AI-generate starters → data/starter_programs.json (review, then load)
```

## Verify

- `node -e "const x=require('./src/lib/xp');console.log(x.pointsForExercise({primaryBodyParts:['Back'],secondaryBodyParts:['Legs'],mechanic:'compound'},{charClass:'warrior'}))"`
  → Back ≈ 95, Legs ≈ 41 (70/30 + Warrior bonuses).
- After seed: `GET /game/shop` returns 124 gear items with tier level-gates.
- `POST /game/workouts/log` with a deadlift returns a Back/Legs/Arms tally and any level-ups.
