# LEVELED — Mobile App (Expo / React Native)

The 8-bit dark-fantasy fitness RPG client. Talks to the backend API in `../backend`.

## Run

**Instant playable demo (no backend needed):**
```bash
cd mobile
npm install
npm start
```
With no `EXPO_PUBLIC_API_URL` set, the app runs in **offline mock mode** — a full
in-memory backend (`src/mockApi.js`) with a seeded mid-game Warrior, the real 124-item
gear catalog, an exercise sample, and challenges. The whole loop works: log a workout →
gain XP → level up (ritual fires) → buy/equip gear → complete challenges. State resets on reload.
(The AI coach is the only feature that needs the real backend.)

**Against the live backend:**
```bash
EXPO_PUBLIC_API_URL=https://your-backend npm start
```
Setting the URL switches off mock mode automatically. Optionally set `EXPO_PUBLIC_USER_ID`
to a real user UUID; otherwise the backend uses the first user row (auth is not built yet).
Force mock even with a URL via `EXPO_PUBLIC_MOCK=1`.

## Structure

| Path | Purpose |
|---|---|
| `App.js` | Bottom-tab navigation + 8-bit dark theme |
| `src/api.js` | Backend client (`/game`, `/programs`, `/challenges`) |
| `src/theme.js` | Colors, spacing, per-body-part + tier palettes |
| `src/assets.js` | Art resolver — maps entities → bundled 8-bit images (null → placeholder until art lands) |
| `src/components/` | `XPBar`, `ui` (Panel / SectionTitle / PixelButton) |
| `src/screens/` | Home, Workout, Programs, Shop, Quests |

## Screens (core loop)

- **Home** — Warrior avatar + five body-part XP bars + today's quests.
- **Workout** — search the 873-exercise library, log sets, `POST /game/workouts/log` → XP tally + level-ups.
- **Programs** — suggested library + AI coach (`/programs/ai-generate`).
- **Shop** — gear by slot/tier with level-gates; buy/equip.
- **Quests** — daily/weekly challenges; complete → XP to tagged body parts.

## Art

Generated 8-bit assets land under `mobile/assets/` and are wired in `src/assets.js`
(static `require()`s, keyed by avatar tier / gear item_id). Until then, screens show
tier-colored placeholders — the app runs without the art.
