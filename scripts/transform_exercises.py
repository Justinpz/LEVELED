# #CC
"""Map Free Exercise DB primaryMuscles -> LEVELED's 5 body-part categories."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "exercises.json"
DST = ROOT / "data" / "exercises_leveled.json"

MUSCLE_TO_BODYPART = {
    "biceps": "Arms",
    "triceps": "Arms",
    "forearms": "Arms",
    "shoulders": "Arms",
    "quadriceps": "Legs",
    "hamstrings": "Legs",
    "calves": "Legs",
    "glutes": "Legs",
    "abductors": "Legs",
    "adductors": "Legs",
    "chest": "Chest",
    "lats": "Back",
    "middle back": "Back",
    "lower back": "Back",
    "traps": "Back",
    "neck": "Back",
    "abdominals": "Core",
}

CATEGORY_ORDER = ["Arms", "Legs", "Chest", "Back", "Core"]


def map_body_parts(muscles):
    """Map a list of muscle names -> ordered, de-duped LEVELED body-part categories."""
    seen = []
    for m in muscles:
        bp = MUSCLE_TO_BODYPART.get(m)
        if bp and bp not in seen:
            seen.append(bp)
    return sorted(seen, key=CATEGORY_ORDER.index)


def transform(ex):
    # Primary 70 / Secondary 30 XP split (project rule): primary muscles drive the
    # primary body parts (70% of the exercise's points), secondary muscles drive the
    # secondary body parts (30%). A body part that is already primary is never also
    # listed as secondary. `bodyParts` stays the union for back-compat + the GIN index.
    primary_bp = map_body_parts(ex.get("primaryMuscles", []))
    secondary_bp = [bp for bp in map_body_parts(ex.get("secondaryMuscles", []))
                    if bp not in primary_bp]
    union_bp = sorted(set(primary_bp) | set(secondary_bp), key=CATEGORY_ORDER.index)
    return {
        "id": ex["id"],
        "name": ex["name"],
        "level": ex.get("level"),
        "force": ex.get("force"),
        "mechanic": ex.get("mechanic"),
        "equipment": ex.get("equipment"),
        "category": ex.get("category"),
        "primaryMuscles": ex.get("primaryMuscles", []),
        "secondaryMuscles": ex.get("secondaryMuscles", []),
        "bodyParts": union_bp,
        "primaryBodyParts": primary_bp,
        "secondaryBodyParts": secondary_bp,
        "instructions": ex.get("instructions", []),
        "images": ex.get("images", []),
    }


def main():
    with SRC.open() as f:
        data = json.load(f)

    out = [transform(ex) for ex in data]

    unmapped = [ex["name"] for ex in out if not ex["primaryBodyParts"]]
    if unmapped:
        print(f"WARNING: {len(unmapped)} exercises produced no primaryBodyParts mapping:")
        for n in unmapped[:10]:
            print(f"  - {n}")

    with DST.open("w") as f:
        json.dump(out, f, indent=2)

    counts = {c: 0 for c in CATEGORY_ORDER}
    for ex in out:
        for bp in ex["bodyParts"]:
            counts[bp] += 1
    with_secondary = sum(1 for ex in out if ex["secondaryBodyParts"])
    print(f"Wrote {len(out)} exercises to {DST.relative_to(ROOT)}")
    print(f"Exercises with a secondary body part (70/30 split applies): {with_secondary}")
    print("Body-part coverage (exercises tagged with each, union):")
    for c in CATEGORY_ORDER:
        print(f"  {c:6s} {counts[c]}")


if __name__ == "__main__":
    main()
