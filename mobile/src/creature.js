// The evolving beast — your lifetime training, made visible.
//
// Six evolution stages driven by TOTAL lifetime XP across every body part.
// Stage art lives in assets/creature/ (cel-shaded shonen ember drake).
// Thresholds are lifetime-XP floors: hit the number, the beast transforms.

export const STAGES = [
  { stage: 1, name: 'EMBER HATCHLING', minXp: 0 },
  { stage: 2, name: 'CINDER WHELP', minXp: 4000 },
  { stage: 3, name: 'ASH STALKER', minXp: 20000 },
  { stage: 4, name: 'WAR DRAKE', minXp: 75000 },
  { stage: 5, name: 'MAGMA BEHEMOTH', minXp: 200000 },
  { stage: 6, name: 'MYTHIC APEX', minXp: 500000 },
];

export const CREATURE_ART = {
  1: require('../assets/creature/stage1.png'),
  2: require('../assets/creature/stage2.png'),
  3: require('../assets/creature/stage3.png'),
  4: require('../assets/creature/stage4.png'),
  5: require('../assets/creature/stage5.png'),
  6: require('../assets/creature/stage6.png'),
};

export function stageFor(totalXp) {
  let current = STAGES[0];
  for (const s of STAGES) if (totalXp >= s.minXp) current = s;
  const next = STAGES[STAGES.indexOf(current) + 1] || null;
  const span = next ? next.minXp - current.minXp : 1;
  const progress = next ? Math.min(1, (totalXp - current.minXp) / span) : 1;
  return { ...current, next, progress, art: CREATURE_ART[current.stage] };
}
