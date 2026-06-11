'use strict';

/**
 * LEVELED XP engine — pure, DB-free, unit-testable. Master doc Part 2 + Part 4.
 *
 * Rules encoded here:
 *  - 100 base points per COMPLETED EXERCISE (not per set; flat — volume/weight
 *    do not multiply the base).
 *  - Compound movements split the 100 as Primary 70 / Secondary 30 across the
 *    exercise's primary vs secondary body parts (each pool divided evenly among
 *    its parts). No secondary parts -> all 100 to primary.
 *  - Curved level thresholds per band (points required to gain each level).
 *  - Warrior class bonuses (single-class MVP): +25% compound lifts, +10% heavy
 *    sets, +10% to Legs/Back/Chest. Gated on charClass === 'warrior'.
 *  - lifetimeXp drives level; spendablePoints is a separate currency and is
 *    handled by the caller (spending never lowers level).
 */

const CATEGORY_ORDER = ['Arms', 'Legs', 'Chest', 'Back', 'Core'];
const BASE_POINTS_PER_EXERCISE = 100;
const MAX_LEVEL = 100;
const WARRIOR_BONUS_PARTS = ['Legs', 'Back', 'Chest'];

// Points required to advance INTO a level (the band the target level falls in).
const LEVEL_BANDS = [
  { maxLevel: 25, perLevel: 30000 },
  { maxLevel: 50, perLevel: 45000 },
  { maxLevel: 75, perLevel: 60000 },
  { maxLevel: 100, perLevel: 90000 },
];

function perLevelCost(level) {
  for (const b of LEVEL_BANDS) if (level <= b.maxLevel) return b.perLevel;
  return LEVEL_BANDS[LEVEL_BANDS.length - 1].perLevel;
}

// Cumulative lifetime XP required to REACH `level` (level 1 = 0 XP).
function xpForLevel(level) {
  let total = 0;
  for (let l = 2; l <= level; l++) total += perLevelCost(l);
  return total;
}

// Level for a given lifetime XP (clamped to MAX_LEVEL).
function levelForXp(lifetimeXp) {
  let level = 1;
  while (level < MAX_LEVEL && lifetimeXp >= xpForLevel(level + 1)) level++;
  return level;
}

// Split `amount` evenly across `parts`, integer points, remainder to first parts.
function distribute(award, parts, amount) {
  if (parts.length === 0) return;
  const per = Math.floor(amount / parts.length);
  let remainder = Math.round(amount - per * parts.length);
  for (const p of parts) {
    award[p] = (award[p] || 0) + per + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
  }
}

// Per-body-part multiplier from Warrior class bonuses.
function warriorMultiplier(exercise, opts) {
  const isWarrior = opts.charClass === 'warrior';
  const compound = exercise.mechanic === 'compound';
  const heavy = !!opts.isHeavy;
  const globalBonus = isWarrior ? (compound ? 0.25 : 0) + (heavy ? 0.1 : 0) : 0;
  const mult = {};
  for (const bp of CATEGORY_ORDER) {
    let m = 1 + globalBonus;
    if (isWarrior && WARRIOR_BONUS_PARTS.includes(bp)) m += 0.1;
    mult[bp] = m;
  }
  return mult;
}

/**
 * Points awarded for one completed exercise, by body part (post-bonus, integer).
 * @param {{primaryBodyParts?:string[], secondaryBodyParts?:string[], mechanic?:string}} exercise
 * @param {{charClass?:string, isHeavy?:boolean}} [opts]
 * @returns {Object<string, number>} e.g. { Back: 88, Legs: 38 }
 */
function pointsForExercise(exercise, opts = {}) {
  const primary = exercise.primaryBodyParts || [];
  const secondary = (exercise.secondaryBodyParts || []).filter((p) => !primary.includes(p));
  const award = {};

  if (primary.length === 0 && secondary.length === 0) return award;
  if (secondary.length === 0) {
    distribute(award, primary, BASE_POINTS_PER_EXERCISE);
  } else if (primary.length === 0) {
    distribute(award, secondary, BASE_POINTS_PER_EXERCISE);
  } else {
    distribute(award, primary, BASE_POINTS_PER_EXERCISE * 0.7);
    distribute(award, secondary, BASE_POINTS_PER_EXERCISE * 0.3);
  }

  const mult = warriorMultiplier(exercise, opts);
  for (const bp of Object.keys(award)) award[bp] = Math.round(award[bp] * mult[bp]);
  return award;
}

/**
 * Apply added XP to a body part's running totals.
 * @returns {{lifetimeXp:number, oldLevel:number, newLevel:number, leveledUp:boolean, levelsGained:number}}
 */
function applyXp(currentLifetimeXp, addedXp) {
  const oldLevel = levelForXp(currentLifetimeXp);
  const lifetimeXp = currentLifetimeXp + addedXp;
  const newLevel = levelForXp(lifetimeXp);
  return {
    lifetimeXp,
    oldLevel,
    newLevel,
    leveledUp: newLevel > oldLevel,
    levelsGained: newLevel - oldLevel,
  };
}

// Tier sub-label for level-up declaration (master doc Part 12).
function levelBandLabel(level) {
  if (level <= 25) return 'Awakening';
  if (level <= 50) return 'Ascending';
  if (level <= 75) return 'Forged';
  return 'Mythic';
}

module.exports = {
  CATEGORY_ORDER,
  BASE_POINTS_PER_EXERCISE,
  MAX_LEVEL,
  LEVEL_BANDS,
  perLevelCost,
  xpForLevel,
  levelForXp,
  pointsForExercise,
  applyXp,
  levelBandLabel,
};
