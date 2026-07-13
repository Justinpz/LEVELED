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

// Offline settings (demo).
const mockSettings = {
  displayName: '', units: 'lbs', barks: true, animations: true,
  levelUpModal: true, warriorShowOriginal: false, restTimer: false, restSeconds: 90,
};

// Offline food log (demo) — mirrors the live 4-macro meter.
const foodItems = [];
let foodGoals = { calories: 2200, protein: 150, carbs: 250, fat: 70 };
function foodToday() {
  const totals = foodItems.reduce(
    (a, it) => ({
      calories: a.calories + it.calories,
      protein: a.protein + it.protein,
      carbs: a.carbs + (it.carbs || 0),
      fat: a.fat + (it.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const part = (have, goal, pen, from = 1) => {
    if (!goal) return 100;
    const r = have / goal;
    return r <= 1 ? r * 100 : !pen || r <= from ? 100 : Math.max(0, 100 - (r - from) * pen);
  };
  const calRatio = totals.calories / foodGoals.calories;
  const score = Math.round(
    0.4 * part(totals.calories, foodGoals.calories, 200) +
    0.25 * part(totals.protein, foodGoals.protein, 0) +
    0.175 * part(totals.carbs, foodGoals.carbs, 100, 1.3) +
    0.175 * part(totals.fat, foodGoals.fat, 100, 1.3)
  );
  const label = calRatio > 1.15 ? 'Overfed' : score >= 90 ? 'Forged' : score >= 75 ? 'Battle-Ready' : score >= 50 ? 'Nourished' : score >= 25 ? 'Underfed' : 'Starving';
  const met = (h, g) => g > 0 && h >= g * 0.9;
  return {
    date: dayKey(),
    goals: foodGoals,
    totals,
    health: { score, label },
    goalsMet: {
      calories: met(totals.calories, foodGoals.calories) && totals.calories <= foodGoals.calories * 1.15,
      protein: met(totals.protein, foodGoals.protein),
      carbs: met(totals.carbs, foodGoals.carbs) && totals.carbs <= foodGoals.carbs * 1.3,
      fat: met(totals.fat, foodGoals.fat) && totals.fat <= foodGoals.fat * 1.3,
    },
    items: foodItems.slice(),
  };
}

export const mockApi = {
  getProgress: () => delay({ userId: 'demo', charClass: 'warrior', currentStreak: streak, progress: progressList() }),

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

  getLastSets: () => delay({ lastSets: {} }),

  getShop: () => {
    const levelBySlot = Object.fromEntries(
      xp.CATEGORY_ORDER.map((bp) => [bp.toLowerCase(), xp.levelForXp(progress[bp].lifetimeXp)])
    );
    const pointsBySlot = Object.fromEntries(
      xp.CATEGORY_ORDER.map((bp) => [bp.toLowerCase(), progress[bp].spendablePoints])
    );
    const items = GEAR.map((it) => {
      const gate = TIER_GATE[it.tier] ?? it.levelGate ?? 1;
      const rec = owned[it.id];
      return { ...it, levelGate: gate, locked: levelBySlot[it.slot] < gate, owned: !!(rec && rec.owned), equipped: !!(rec && rec.equipped) };
    });
    const totalPoints = Object.values(pointsBySlot).reduce((a, b) => a + b, 0);
    const HORIZON = 10;
    const visible = items.filter((it) => it.owned || it.levelGate <= levelBySlot[it.slot] + HORIZON);
    return delay({ levelBySlot, pointsBySlot, totalPoints, items: visible });
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

  unequipGear: (id) => {
    if (owned[id]) owned[id].equipped = false;
    return delay({ unequipped: id });
  },

  getPrograms: () => delay({ programs: [
    { id: 'p1', name: 'Warrior Foundation', description: 'Full-body strength base', daysPerWeek: 3, durationWeeks: 8, isStarter: true, days: [] },
    { id: 'p2', name: 'Iron Back & Arms', description: 'The Warrior path', daysPerWeek: 4, durationWeeks: 6, isStarter: true, days: [] },
    { id: 'p3', name: 'Ascendant Push/Pull/Legs', description: 'High volume', daysPerWeek: 6, durationWeeks: 8, isStarter: true, days: [] },
  ] }),
  getProgram: (id) => delay({ program: { id, name: 'Program', days: [] } }),
  getActiveProgram: () => delay({ program: null, suggestedDay: null }),
  selectProgram: (id) => delay({ selected: id }),
  clearProgram: () => delay({ selected: null }),
  createProgram: (p) => delay({ program: { ...p, id: `custom_${Date.now()}` } }),
  aiGenerateProgram: () => Promise.reject(Object.assign(new Error('AI coach needs a live backend + API key'), { status: 503 })),
  aiValidateWorkout: () => Promise.reject(Object.assign(new Error('AI coach needs a live backend + API key'), { status: 503 })),

  getDailyChallenge: () => {
    const pool = CHALLENGES.filter((x) => x.kind === 'daily');
    const picks = pool.slice(0, 3).map((c) => ({ ...c, id: c.title, completed: completedChallenges.has(c.title) }));
    return delay({ date: dayKey(), challenges: picks, challenge: picks[0] || null });
  },
  getWeeklyChallenge: () => {
    const pool = CHALLENGES.filter((x) => x.kind === 'weekly');
    const picks = pool.slice(0, 3).map((c) => ({ ...c, id: c.title, completed: completedChallenges.has(c.title) }));
    return delay({ week: dayKey().slice(0, 7), challenges: picks, challenge: picks[0] || null });
  },
  getWarriorChallenge: () =>
    delay({
      date: dayKey(),
      bookDay: 1,
      quote: "If it's important, do it every day.",
      author: 'Dan Gable',
      originalSession: 'Work to a heavy single deadlift, then 5x5 at 70%.',
      homeEdition: ['100 air squats', '50 push-ups', '3x30s plank'],
      rewardPts: 150,
      challengeId: 'warrior-demo',
      completed: completedChallenges.has('warrior-demo'),
    }),
  getSettings: () => delay({ settings: mockSettings }),
  putSettings: (patch) => {
    Object.assign(mockSettings, patch);
    return delay({ settings: mockSettings });
  },

  getFoodToday: () => delay(foodToday()),
  getFoodCalendar: () => delay({ month: dayKey().slice(0, 7), goals: foodGoals, days: [] }),
  getFoodDay: (date) => delay({ date, goals: foodGoals, totals: { calories: 0, protein: 0, carbs: 0, fat: 0 }, health: null, items: [], workouts: [], challenges: [] }),
  logFood: (item) => {
    foodItems.push({
      id: `f${Date.now()}`,
      name: item.name,
      calories: Number(item.calories) || 0,
      protein: Number(item.protein) || 0,
      carbs: Number(item.carbs) || 0,
      fat: Number(item.fat) || 0,
    });
    return delay(foodToday());
  },
  deleteFood: (id) => {
    const i = foodItems.findIndex((f) => f.id === id);
    if (i >= 0) foodItems.splice(i, 1);
    return delay(foodToday());
  },
  setFoodGoals: (g) => {
    if (g.calorieGoal) foodGoals.calories = Number(g.calorieGoal);
    if (g.proteinGoal) foodGoals.protein = Number(g.proteinGoal);
    if (g.carbGoal) foodGoals.carbs = Number(g.carbGoal);
    if (g.fatGoal) foodGoals.fat = Number(g.fatGoal);
    return delay(foodToday());
  },
  completeChallenge: (id) => {
    if (completedChallenges.has(id)) return Promise.reject(new Error('Already completed'));
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
