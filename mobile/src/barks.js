// Avatar barks — what the Warrior says when you tap him on the Home screen.
// Lines scale with the character's level band so his voice grows with his body,
// and a few react to streak state. All workout-flavored, all in-world.

const BARKS = {
  // Tier 1 (levels 1-20) — scrawny novice, hungry to grow
  1: [
    'The bar is heavy. Good. So was I, once — heavy with excuses.',
    'Every rep is a coin paid toward the warrior I will become.',
    "Don't pity these thin arms. They're a promise, not a weakness.",
    'I lifted today. That already makes this day a victory.',
    'The forge is lit. Bring me iron.',
  ],
  // Tier 2 (21-40)
  2: [
    'The runes on my gear glow brighter after every session.',
    'I remember when the empty bar felt heavy. Now it bends.',
    'Strength is a spell with only one incantation: again.',
    'My shadow is wider than it used to be. Earned, not given.',
    'Rest is part of training. But so is getting back up.',
  ],
  // Tier 3 (41-60)
  3: [
    'The stars watched me train when no one else did.',
    'Gravity is just another sparring partner now.',
    'Each plate on the bar is a fallen doubt.',
    'I do not chase numbers. I chase the warrior in the mirror.',
    'Light work today. Heavy glory tomorrow.',
  ],
  // Tier 4 (61-80)
  4: [
    'I have trained in the void where motivation dies. Discipline carried me out.',
    'The dark whispers "skip today." I lift the dark too.',
    'Pain is tribute. The abyss collects, and I pay gladly.',
    'What broke me once now warms up my sets.',
    'Even shadows spot my lifts now.',
  ],
  // Tier 5 (81-100) — god-tier
  5: [
    'Mountains ask ME for a spot.',
    'I no longer lift the weight. I permit it to descend.',
    'A hundred levels of iron, and still the first rep humbles me.',
    'My warm-up was once my dream max. Keep going. Yours will be too.',
    'Transcendence is just consistency, compounded.',
  ],
};

const STREAK_BARKS = [
  { min: 30, line: (n) => `${n} days unbroken. The gods keep a tally, and so do I.` },
  { min: 14, line: (n) => `${n} days of war without retreat. Legendary.` },
  { min: 7, line: (n) => `A ${n}-day streak — the Streak Shop's gates stand open for me.` },
  { min: 3, line: (n) => `${n} days in a row. The chain grows heavy — never break it.` },
];

// tier = avatar tier 1-5 (ceil(overallLevel / 20)), same as avatarForLevel().
export function barkFor(tier, streak) {
  // ~1 in 3 taps references an active streak instead of the tier line.
  if (streak >= 3 && Math.random() < 0.34) {
    const s = STREAK_BARKS.find((b) => streak >= b.min);
    if (s) return s.line(streak);
  }
  const pool = BARKS[tier] || BARKS[1];
  return pool[Math.floor(Math.random() * pool.length)];
}
