# PT Roulette

**Live at [pt-roulette.higgsfield.app](https://pt-roulette.higgsfield.app)** — share the
link with the group, or save the page to a phone for offline use.

A randomized bodyweight PT game for group workouts — built for sessions where
part of the group can't run. One file, no install, no network needed: open
`index.html` in any browser (works great on a phone) and the deck picks the
exercises so nobody has to.

## Using it

Send `index.html` to your phone (AirDrop / Files / email attachment) and open
it, or host it anywhere static. Everything — 84 military bodyweight movements
with form cues — is embedded in the file, so it works with zero signal.

**Draw mode** — tap DRAW, the deck flips a card: exercise + rep count (or hold
time, with a built-in countdown timer). DONE logs it to the session tally and
draws the next one. No exercise repeats until the whole deck has been used.

**Circuit mode** — pick stations, rounds, and rest; BUILD CIRCUIT generates a
workout balanced across cardio/legs/push/core/pull. Reroll any single station
with ↻. RUN IT steps the group through it full-screen with rest countdowns,
beeps, and a wake-lock so the screen stays on.

**Settings**

- **No jumping** (default ON) — hides all jump/impact moves, for people on
  profile. This is the reason this exists.
- **Intensity** — Warm-up / Standard / Smoke (scales reps and hold times).
- **Difficulty ceiling** — Basic / Standard / All (caps exercise level).
- **Pull-up bar / bench available** — several "body only" library exercises
  quietly need one; they stay hidden until you say you have it.
- **Target areas** — limit the deck to specific muscle buckets.
- Settings persist on the device (localStorage).

## Where the exercises come from

The pool is a hand-curated military bodyweight PT deck, authored directly in
`build_data.py`: Army PRT drill exercises by the numbers (Preparation Drill,
Conditioning Drills 1–2, and the Recovery Drill as the cooldown), ACFT
movements (hand-release push-ups, leg tucks, the plank), and the formation-PT
classics — flutter kicks, hello dollies, 8-count bodybuilders, iron mikes,
side-straddle hops. 4-count movements are labeled and counted the way they're
called. Jumps are flagged for the no-jump filter, holds are timed, per-side
moves are labeled, and bar/bench-dependent moves hide behind the equipment
toggles.

To tweak the pool (rep bases, tags, add or drop movements), edit the `POOL`
list in `build_data.py` and run:

```bash
python3 pt-game/build_data.py
```

It rewrites the data block embedded in `index.html` in place.
