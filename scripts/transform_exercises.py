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


def map_body_parts(primary_muscles):
    seen = []
    for m in primary_muscles:
        bp = MUSCLE_TO_BODYPART.get(m)
        if bp and bp not in seen:
            seen.append(bp)
    return sorted(seen, key=CATEGORY_ORDER.index)


def transform(ex):
    return {
        "id": ex["id"],
        "name": ex["name"],
        "level": ex.get("level"),
        "force": ex.get("force"),
        "mechanic": ex.get("mechanic"),
        "equipment": ex.get("equipment"),
        "category": ex.get("category"),
        "primaryMuscles": ex.get("primaryMuscles", []),
        "bodyParts": map_body_parts(ex.get("primaryMuscles", [])),
        "instructions": ex.get("instructions", []),
        "images": ex.get("images", []),
    }


def main():
    with SRC.open() as f:
        data = json.load(f)

    out = [transform(ex) for ex in data]

    unmapped = [ex["name"] for ex in out if not ex["bodyParts"]]
    if unmapped:
        print(f"WARNING: {len(unmapped)} exercises produced no bodyParts mapping:")
        for n in unmapped[:10]:
            print(f"  - {n}")

    with DST.open("w") as f:
        json.dump(out, f, indent=2)

    counts = {c: 0 for c in CATEGORY_ORDER}
    for ex in out:
        for bp in ex["bodyParts"]:
            counts[bp] += 1
    print(f"Wrote {len(out)} exercises to {DST.relative_to(ROOT)}")
    print("Body-part coverage (exercises tagged with each):")
    for c in CATEGORY_ORDER:
        print(f"  {c:6s} {counts[c]}")


if __name__ == "__main__":
    main()
