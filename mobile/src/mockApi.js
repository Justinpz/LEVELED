// In-memory mock backend — lets the app run as a full playable demo with no server.
// Mirrors the real API surface in api.js and uses the same XP rules (src/xp.js).
// State lives for the app session (resets on reload).

import GEAR from './data/gear.json';
import EXERCISES from './data/exercises.json';
import CHALLENGES from './data/challenges.json';
import * as xp from './xp';

const TIER_GATE = { iron: 1, mythic: 21, celestial: 41, abyssal: 61, ascendant: 81 };

// Seed some starting progress so the demo isn't empty (mid-game character).
const progress = {
  Arms: { lifetimeXp: 210000, spendablePoints: 1400 },
  Legs: { lifetimeXp: 520000, spendablePoints: 2600 },
  Chest: { lifetimeXp: 95000, spendablePoints: 900 },
  Back: { lifetimeXp: 640000, spendablePoints: 3100 },
  Core: { lifetimeXp: 180000, spendablePoints: 1200 },
};
const owned = {}; // gearItemId -> { owned, equipped }
const completedChallenges = new Set();
let streak = 4;

const slotToPart = (slot) => slot.charAt(0).toUpperCase() + slot.slice(1);
const delay = (v) => new Promise((r) => setTimeout(() => r(v), 120));

function progressList() {
  return xp.CATEGORY_ORDER.map((bp) => {
    const p = progress[bp];
    const level = xp.levelForXp(p.lifetimeXp);
    return {
      bodyPart: bp, level, lifetimeXp: p.lifetimeXp, spendablePoints: p.spendablePoints,
      nextLevelXp: level < xp.MAX_LEVEL ? xp.xpForLevel(level + 1) : null,
      band: xp.levelBandLabel(level),
    };
  });
}

function dailyPick(pool, key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return pool.length ? pool[h % pool.length] : null;
}
const dayKey = () => new Date().toISOString().slice(0, 10);

export const mockApi = {
  getProgress: () => delay({ userId: 'demo', charClass: 'warrior', progress: progressList() }),

  getExercises: (query = '') => {
    const m = /search=([^&]*)/.exec(query);
    const term = m ? decodeURIComponent(m[1]).toLowerCase() : '';
    const items = EXERCISES.filter((e) => !term || e.name.toLowerCase().includes(term)).slice(0, 50);
    return delay({ total: items.length, items });
  },

  logWorkout: (payload) => {
    const totals = {};
    const perExercise = [];
    for (const e of payload.exercises || []) {
      const ex = EXERCISES.find((x) => x.id === e.exerciseId) || {};
      const award = xp.pointsForExercise(ex, { charClass: 'warrior', isHeavy: !!e.isHeavy });
      perExercise.push({ exerciseId: e.exerciseId, award });
      for (const [bp, pts] of Object.entries(award)) totals[bp] = (totals[bp] || 0) + pts;
    }
    const levelUps = [];
    for (const [bp, pts] of Object.entries(totals)) {
      const p = progress[bp];
      const r = xp.applyXp(p.lifetimeXp, pts);
      p.lifetimeXp = r.lifetimeXp;
      p.spendablePoints += pts;
      if (r.leveledUp) levelUps.push({ bodyPart: bp, from: r.oldLevel, to: r.newLevel, band: xp.levelBandLabel(r.newLevel) });
    }
    streak += 1;
    return delay({ tally: totals, perExercise, levelUps });
  },

  getShop: () => {
    const levelBySlot = Object.fromEntries(
      xp.CATEGORY_ORDER.map((bp) => [bp.toLowerCase(), xp.levelForXp(progress[bp].lifetimeXp)])
    );
    const items = GEAR.map((it) => {
      const gate = TIER_GATE[it.tier] ?? it.levelGate ?? 1;
      const rec = owned[it.id];
      return { ...it, levelGate: gate, locked: levelBySlot[it.slot] < gate, owned: !!(rec && rec.owned), equipped: !!(rec && rec.equipped) };
    });
    return delay({ levelBySlot, items });
  },

  buyGear: (id) => {
    const it = GEAR.find((g) => g.id === id);
    const part = slotToPart(it.slot);
    const p = progress[part];
    const gate = TIER_GATE[it.tier] ?? 1;
    if (xp.levelForXp(p.lifetimeXp) < gate) return Promise.reject(new Error('Locked'));
    if (p.spendablePoints < it.costPts) return Promise.reject(new Error('Not enough points'));
    p.spendablePoints -= it.costPts;
    owned[id] = { owned: true, equipped: false };
    return delay({ purchased: id });
  },

  equipGear: (id) => {
    const it = GEAR.find((g) => g.id === id);
    for (const gid of Object.keys(owned)) {
      const g = GEAR.find((x) => x.id === gid);
      if (g && g.slot === it.slot) owned[gid].equipped = false;
    }
    owned[id] = { owned: true, equipped: true };
    return delay({ equipped: id, slot: it.slot });
  },

  getPrograms: () => delay({ programs: [
    { id: 'p1', name: 'Warrior Foundation', description: 'Full-body strength base', daysPerWeek: 3, durationWeeks: 8, isStarter: true, days: [] },
    { id: 'p2', name: 'Iron Back & Arms', description: 'The Warrior path', daysPerWeek: 4, durationWeeks: 6, isStarter: true, days: [] },
    { id: 'p3', name: 'Ascendant Push/Pull/Legs', description: 'High volume', daysPerWeek: 6, durationWeeks: 8, isStarter: true, days: [] },
  ] }),
  getProgram: (id) => delay({ program: { id, name: 'Program', days: [] } }),
  aiGenerateProgram: () => Promise.reject(Object.assign(new Error('AI coach needs a live backend + API key'), { status: 503 })),
  aiValidateWorkout: () => Promise.reject(Object.assign(new Error('AI coach needs a live backend + API key'), { status: 503 })),

  getDailyChallenge: () => {
    const c = dailyPick(CHALLENGES.filter((x) => x.kind === 'daily'), `daily:${dayKey()}`);
    return delay({ date: dayKey(), challenge: c ? { ...c, id: c.title } : null });
  },
  getWeeklyChallenge: () => {
    const c = dailyPick(CHALLENGES.filter((x) => x.kind === 'weekly'), 'weekly');
    return delay({ week: dayKey().slice(0, 7), challenge: c ? { ...c, id: c.title } : null });
  },
  completeChallenge: (id) => {
    const c = CHALLENGES.find((x, i) => `c${i}` === id) || CHALLENGES.find((x) => x.title === id);
    const ch = c || { rewardPts: 100, bodyPartTargets: [] };
    const targets = (ch.bodyPartTargets && ch.bodyPartTargets.length) ? ch.bodyPartTargets : xp.CATEGORY_ORDER;
    const per = Math.round(ch.rewardPts / targets.length);
    const levelUps = [];
    for (const bp of targets) {
      const p = progress[bp];
      const r = xp.applyXp(p.lifetimeXp, per);
      p.lifetimeXp = r.lifetimeXp; p.spendablePoints += per;
      if (r.leveledUp) levelUps.push({ bodyPart: bp, from: r.oldLevel, to: r.newLevel });
    }
    completedChallenges.add(id);
    return delay({ rewardPts: ch.rewardPts, perBodyPart: per, targets, levelUps, streakShopUnlocked: streak >= 7 });
  },
};
