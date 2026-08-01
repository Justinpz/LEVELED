#!/usr/bin/env python3
"""Regenerate the exercise pool embedded in pt-game/index.html.

Reads ../data/exercises.json, keeps equipment == "body only", applies the
curation tables below (equipment quirks, jump impact, timed holds, per-side
moves, rep/time bases), adds a few group-PT staples the library is missing,
and rewrites the block between PT_DATA_START / PT_DATA_END in index.html.

Run from anywhere:  python3 pt-game/build_data.py
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIBRARY = HERE.parent / "data" / "exercises.json"
HTML = HERE / "index.html"

# "body only" entries that actually need gear we can't assume at PT.
EXCLUDE = {
    "Crunch - Legs On Exercise Ball",            # exercise ball
    "Close-Grip Push-Up off of a Dumbbell",      # dumbbell
    "Standing Towel Triceps Extension",          # towel
    "Natural Glute Ham Raise",                   # partner anchoring feet
    "Hyperextensions With No Hyperextension Bench",  # partner anchoring feet
    "Body Tricep Press",                         # bar racked at chest height
}

# Needs a pull-up bar or dip station.
NEEDS_BAR = {
    "Chin-Up", "Pullups", "V-Bar Pullup", "Wide-Grip Rear Pull-Up",
    "Hanging Leg Raise", "Hanging Pike", "Gorilla Chin/Crunch",
    "Wind Sprints", "Dips - Triceps Version",
}

# Needs a bench, step, curb, or similar elevation.
NEEDS_BENCH = {
    "Bench Dips", "Bench Jump", "Decline Crunch", "Decline Oblique Crunch",
    "Decline Reverse Crunch", "Flat Bench Leg Pull-In",
    "Flat Bench Lying Leg Raise", "Seated Flat Bench Leg Pull-In",
    "Incline Push-Up", "Incline Push-Up Close-Grip", "Incline Push-Up Medium",
    "Incline Push-Up Reverse Grip", "Incline Push-Up Wide",
    "Push-Ups With Feet Elevated", "Step-up with Knee Raise",
}

# Jumping / high-impact — filtered out by the profile-friendly toggle.
IMPACT = {
    "Bench Jump", "Double Leg Butt Kick", "Fast Skipping",
    "Freehand Jump Squat", "Knee Tuck Jump", "Lateral Bound", "Plyo Push-up",
    "Rocket Jump", "Scissors Jump", "Single Leg Butt Kick", "Split Jump",
    "Standing Long Jump", "Star Jump",
}

# Static holds measured in seconds, not reps.
TIMED = {
    "Plank", "Side Bridge", "Stomach Vacuum", "Isometric Chest Squeezes",
    "Isometric Wipers", "Isometric Neck Exercise - Front And Back",
    "Isometric Neck Exercise - Sides", "Superman", "90/90 Hamstring",
    "All Fours Quad Stretch", "Lower Back Curl", "Lying Crossover",
    "Lying Glute", "Lying Prone Quadriceps", "Overhead Triceps",
    "Seated Biceps", "Seated Front Deltoid", "Seated Glute",
}

# Count (or hold) applies to each side.
PER_SIDE = {
    "Side Bridge", "Single Leg Glute Bridge", "Single Leg Butt Kick",
    "Side Jackknife", "Oblique Crunches", "Oblique Crunches - On The Floor",
    "Side Leg Raises", "Front Leg Raises", "Rear Leg Raises",
    "Glute Kickback", "Single-Arm Push-Up", "All Fours Quad Stretch",
    "90/90 Hamstring", "Lying Crossover", "Lying Glute",
    "Lying Prone Quadriceps", "Overhead Triceps", "Seated Front Deltoid",
    "Seated Glute", "Wind Sprints",
}

# Hand-tuned base amounts (reps, or seconds for TIMED entries).
BASE_OVERRIDES = {
    "Pushups": 15, "Push-Up Wide": 12, "Pushups (Close and Wide Hand Positions)": 12,
    "Push-Ups - Close Triceps Position": 10, "Push Up to Side Plank": 10,
    "Clock Push-Up": 8, "Single-Arm Push-Up": 5, "Handstand Push-Ups": 5,
    "Bodyweight Squat": 20, "Freehand Jump Squat": 15,
    "Plank": 45, "Side Bridge": 30, "Superman": 30,
    "Crunches": 20, "Sit-Up": 15, "3/4 Sit-Up": 15, "Flutter Kicks": 20,
    "Russian Twist": 20, "Dead Bug": 10, "Air Bike": 20,
    "Chin-Up": 6, "Pullups": 6, "Dips - Triceps Version": 8,
    "Bench Dips": 12, "Stomach Vacuum": 20,
}

BUCKETS = {
    "chest": "push", "triceps": "push", "shoulders": "push",
    "quadriceps": "legs", "glutes": "legs", "hamstrings": "legs",
    "calves": "legs", "adductors": "legs", "abductors": "legs",
    "abdominals": "core", "lower back": "core", "neck": "core",
    "lats": "pull", "biceps": "pull", "forearms": "pull",
    "middle back": "pull", "traps": "pull",
}

DEFAULT_REPS = {  # bucket -> {level: reps}
    "push": {"beginner": 12, "intermediate": 8, "expert": 5},
    "legs": {"beginner": 20, "intermediate": 12, "expert": 8},
    "core": {"beginner": 20, "intermediate": 12, "expert": 8},
    "pull": {"beginner": 8, "intermediate": 5, "expert": 3},
    "cardio": {"beginner": 15, "intermediate": 10, "expert": 8},
}

# Group-PT staples the 873-exercise library doesn't carry as "body only".
EXTRAS = [
    dict(name="Burpee", bucket="cardio", level="intermediate", timed=False,
         perSide=False, impact=True, needs=None, base=10, stretch=False,
         instructions=[
             "From standing, squat down and place your hands on the ground.",
             "Kick your feet back into a push-up position and perform one push-up.",
             "Jump your feet back to your hands, then jump straight up with arms overhead.",
         ]),
    dict(name="No-Jump Burpee", bucket="cardio", level="beginner", timed=False,
         perSide=False, impact=False, needs=None, base=10, stretch=False,
         instructions=[
             "From standing, squat down and place your hands on the ground.",
             "Step one foot back at a time into a plank position.",
             "Step your feet back in one at a time, then stand tall. No jumping at any point.",
         ]),
    dict(name="Mountain Climbers", bucket="cardio", level="beginner", timed=True,
         perSide=False, impact=False, needs=None, base=30, stretch=False,
         instructions=[
             "Start in a high plank with hands under your shoulders.",
             "Drive one knee toward your chest, then switch legs in a running motion.",
             "Keep your hips low and core tight the whole time.",
         ]),
    dict(name="Bear Crawl", bucket="cardio", level="beginner", timed=True,
         perSide=False, impact=False, needs=None, base=30, stretch=False,
         instructions=[
             "Start on hands and feet with knees bent and hovering just off the ground.",
             "Crawl forward moving opposite hand and foot together.",
             "Keep your back flat and hips low; crawl backward to return.",
         ]),
    dict(name="Forward Lunge", bucket="legs", level="beginner", timed=False,
         perSide=True, impact=False, needs=None, base=10, stretch=False,
         instructions=[
             "Stand tall, then step forward with one leg.",
             "Lower until both knees are bent about 90 degrees; keep the front knee over the ankle.",
             "Push off the front foot to return to standing and switch legs.",
         ]),
    dict(name="Reverse Lunge", bucket="legs", level="beginner", timed=False,
         perSide=True, impact=False, needs=None, base=10, stretch=False,
         instructions=[
             "Stand tall, then step backward with one leg.",
             "Lower until both knees are bent about 90 degrees, keeping your chest up.",
             "Drive through the front heel to return to standing and switch legs.",
         ]),
    dict(name="Side Lunge", bucket="legs", level="beginner", timed=False,
         perSide=True, impact=False, needs=None, base=8, stretch=False,
         instructions=[
             "Stand with feet together, then take a wide step to one side.",
             "Sit back into the stepping leg, keeping the other leg straight.",
             "Push back to standing and repeat on the other side.",
         ]),
    dict(name="Wall Sit", bucket="legs", level="beginner", timed=True,
         perSide=False, impact=False, needs=None, base=45, stretch=False,
         instructions=[
             "Stand with your back flat against a wall or tree.",
             "Slide down until your thighs are parallel to the ground, knees at 90 degrees.",
             "Hold the position with your weight through your heels.",
         ]),
    dict(name="Squat Hold", bucket="legs", level="beginner", timed=True,
         perSide=False, impact=False, needs=None, base=30, stretch=False,
         instructions=[
             "Squat down until your thighs are parallel to the ground.",
             "Keep your chest up, heels down, and arms out front for balance.",
             "Hold the bottom position without standing up.",
         ]),
    dict(name="Standing Calf Raise", bucket="legs", level="beginner", timed=False,
         perSide=False, impact=False, needs=None, base=20, stretch=False,
         instructions=[
             "Stand tall with feet hip-width apart.",
             "Rise up onto the balls of your feet as high as you can.",
             "Lower under control until your heels touch the ground.",
         ]),
    dict(name="Plank Shoulder Taps", bucket="core", level="beginner", timed=False,
         perSide=False, impact=False, needs=None, base=20, stretch=False,
         instructions=[
             "Start in a high plank with feet slightly wider than hips.",
             "Tap your left shoulder with your right hand, then switch sides.",
             "Keep your hips square to the ground; each tap is one rep.",
         ]),
    dict(name="Arm Circles", bucket="push", level="beginner", timed=True,
         perSide=False, impact=False, needs=None, base=30, stretch=False,
         instructions=[
             "Stand with arms extended straight out to the sides.",
             "Make small circles forward, gradually growing larger.",
             "Reverse direction halfway through the time.",
         ]),
]


def build():
    library = json.loads(LIBRARY.read_text())
    pool = []
    for e in library:
        if e.get("equipment") != "body only" or e["name"] in EXCLUDE:
            continue
        name = e["name"]
        muscle = (e.get("primaryMuscles") or ["abdominals"])[0]
        bucket = "cardio" if e.get("category") == "plyometrics" else BUCKETS.get(muscle, "core")
        timed = name in TIMED
        level = e.get("level", "beginner")
        if name in BASE_OVERRIDES:
            base = BASE_OVERRIDES[name]
        elif timed:
            base = 25 if e.get("category") == "stretching" else 30
        else:
            base = DEFAULT_REPS[bucket][level]
        pool.append(dict(
            name=name, bucket=bucket, level=level, timed=timed,
            perSide=name in PER_SIDE, impact=name in IMPACT,
            needs="bar" if name in NEEDS_BAR else ("bench" if name in NEEDS_BENCH else None),
            base=base, stretch=e.get("category") == "stretching",
            instructions=e.get("instructions", []),
        ))
    pool.extend(EXTRAS)
    pool.sort(key=lambda x: x["name"])
    return pool


def main():
    pool = build()
    blob = json.dumps(pool, separators=(",", ":"))
    html = HTML.read_text()
    new = re.sub(
        r"(/\*PT_DATA_START\*/).*?(/\*PT_DATA_END\*/)",
        lambda m: m.group(1) + "const POOL=" + blob + ";" + m.group(2),
        html, flags=re.S,
    )
    HTML.write_text(new)
    counts = {}
    for e in pool:
        counts[e["bucket"]] = counts.get(e["bucket"], 0) + 1
    print(f"Embedded {len(pool)} exercises: {counts}")


if __name__ == "__main__":
    main()
