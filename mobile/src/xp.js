// Client port of the backend XP engine (backend/src/lib/xp.js) for offline mock mode.
// Keep in sync with the server. Master doc Part 2 + Part 4.

export const CATEGORY_ORDER = ['Arms', 'Legs', 'Chest', 'Back', 'Core'];
const BASE = 100;
export const MAX_LEVEL = 100;
const WARRIOR_BONUS_PARTS = ['Legs', 'Back', 'Chest'];
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
export function xpForLevel(level) {
  let t = 0;
  for (let l = 2; l <= level; l++) t += perLevelCost(l);
  return t;
}
export function levelForXp(xp) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}
function distribute(award, parts, amount) {
  if (!parts.length) return;
  const per = Math.floor(amount / parts.length);
  let rem = Math.round(amount - per * parts.length);
  for (const p of parts) {
    award[p] = (award[p] || 0) + per + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
  }
}
function warriorMultiplier(ex, opts) {
  const warrior = opts.charClass === 'warrior';
  const compound = ex.mechanic === 'compound';
  const heavy = !!opts.isHeavy;
  const global = warrior ? (compound ? 0.25 : 0) + (heavy ? 0.1 : 0) : 0;
  const m = {};
  for (const bp of CATEGORY_ORDER) {
    let v = 1 + global;
    if (warrior && WARRIOR_BONUS_PARTS.includes(bp)) v += 0.1;
    m[bp] = v;
  }
  return m;
}
export function pointsForExercise(ex, opts = {}) {
  const primary = ex.primaryBodyParts || [];
  const secondary = (ex.secondaryBodyParts || []).filter((p) => !primary.includes(p));
  const award = {};
  if (!primary.length && !secondary.length) return award;
  if (!secondary.length) distribute(award, primary, BASE);
  else if (!primary.length) distribute(award, secondary, BASE);
  else {
    distribute(award, primary, BASE * 0.7);
    distribute(award, secondary, BASE * 0.3);
  }
  const mult = warriorMultiplier(ex, opts);
  for (const bp of Object.keys(award)) award[bp] = Math.round(award[bp] * mult[bp]);
  return award;
}
export function applyXp(current, added) {
  const oldLevel = levelForXp(current);
  const lifetimeXp = current + added;
  const newLevel = levelForXp(lifetimeXp);
  return { lifetimeXp, oldLevel, newLevel, leveledUp: newLevel > oldLevel };
}
export function levelBandLabel(level) {
  if (level <= 25) return 'Awakening';
  if (level <= 50) return 'Ascending';
  if (level <= 75) return 'Forged';
  return 'Mythic';
}
