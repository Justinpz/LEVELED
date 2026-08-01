# PT Roulette

**Live at [pt-roulette.higgsfield.app](https://pt-roulette.higgsfield.app)** — share the
link with the group, or save the page to a phone for offline use.

A randomized bodyweight PT game for group workouts — built for sessions where
part of the group can't run. One file, no install, no network needed: open
`index.html` in any browser (works great on a phone) and the deck picks the
exercises so nobody has to.

## Using it

Send `index.html` to your phone (AirDrop / Files / email attachment) and open
it, or host it anywhere static. Everything — 117 exercises with instructions —
is embedded in the file, so it works with zero signal.

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

The pool is the bodyweight (`equipment: "body only"`) slice of the LEVELED
873-exercise library (`../data/exercises.json`), curated in
`build_data.py`: entries needing gear we can't assume are tagged (bar/bench)
or dropped (ball/dumbbell/partner), jumps are flagged for the no-jump filter,
static holds are marked as timed, per-side moves are labeled, plus a dozen
group-PT staples the library lacks (burpees, lunges, wall sits, mountain
climbers, …).

To tweak the pool (rep bases, tags, extra exercises), edit the tables at the
top of `build_data.py` and run:

```bash
python3 pt-game/build_data.py
```

It rewrites the data block embedded in `index.html` in place.
