'use strict';

/**
 * Food tracker + health meter + calendar.
 *
 * Log what you eat (calories, protein, carbs, fat); the health meter (0-100)
 * moves with intake vs the user's macro goals:
 *   - calories weigh 40%: fill toward the goal, drain 2 pts per 1% past it
 *   - protein 25%, carbs 17.5%, fat 17.5%: fill toward the goal, capped —
 *     protein overshoot never hurts; carbs/fat drain gently past 130%
 *
 * Calendar: month rollup of macros + goals-met flags per day, and a per-day
 * detail (foods + workouts + challenges conquered) for the tap-through view.
 *
 * Day bucketing is UTC to match the workout streak logic.
 */

const express = require('express');
const prisma = require('../db/prisma');

const router = express.Router();

async function resolveUser(req) {
  const headerId = req.header('x-user-id');
  if (headerId) return prisma.user.findUnique({ where: { id: headerId } });
  return prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
}

function todayUtc() {
  return new Date(new Date().toISOString().slice(0, 10)); // midnight UTC
}

function goalsOf(user) {
  return {
    calories: user.calorieGoal,
    protein: user.proteinGoal,
    carbs: user.carbGoal,
    fat: user.fatGoal,
  };
}

const EMPTY_TOTALS = { calories: 0, protein: 0, carbs: 0, fat: 0 };

function sumItems(items) {
  return items.reduce(
    (a, it) => ({
      calories: a.calories + it.calories,
      protein: a.protein + it.protein,
      carbs: a.carbs + (it.carbs || 0),
      fat: a.fat + (it.fat || 0),
    }),
    { ...EMPTY_TOTALS }
  );
}

function macroScore(have, goal, { overPenalty = 0, overFrom = 1 } = {}) {
  if (!goal || goal <= 0) return 100;
  const ratio = (have || 0) / goal;
  if (ratio <= 1) return ratio * 100;
  if (!overPenalty || ratio <= overFrom) return 100;
  return Math.max(0, 100 - (ratio - overFrom) * overPenalty);
}

function healthMeter(totals, goals) {
  const calRatio = goals.calories > 0 ? totals.calories / goals.calories : 0;
  const calScore = macroScore(totals.calories, goals.calories, { overPenalty: 200 });
  const proteinScore = macroScore(totals.protein, goals.protein); // overshoot never hurts
  const carbScore = macroScore(totals.carbs, goals.carbs, { overPenalty: 100, overFrom: 1.3 });
  const fatScore = macroScore(totals.fat, goals.fat, { overPenalty: 100, overFrom: 1.3 });
  const score = Math.round(0.4 * calScore + 0.25 * proteinScore + 0.175 * carbScore + 0.175 * fatScore);

  let label;
  if (calRatio > 1.15) label = 'Overfed';
  else if (score >= 90) label = 'Forged';
  else if (score >= 75) label = 'Battle-Ready';
  else if (score >= 50) label = 'Nourished';
  else if (score >= 25) label = 'Underfed';
  else label = 'Starving';

  return {
    score,
    label,
    calRatio: Math.round(calRatio * 100) / 100,
    breakdown: {
      calories: Math.round(calScore),
      protein: Math.round(proteinScore),
      carbs: Math.round(carbScore),
      fat: Math.round(fatScore),
    },
  };
}

// A goal counts as met at >=90% (and calories also not blown >15% past).
function goalsMet(totals, goals) {
  const met = (have, goal) => goal > 0 && have >= goal * 0.9;
  return {
    calories: met(totals.calories, goals.calories) && totals.calories <= goals.calories * 1.15,
    protein: met(totals.protein, goals.protein),
    carbs: met(totals.carbs, goals.carbs) && totals.carbs <= goals.carbs * 1.3,
    fat: met(totals.fat, goals.fat) && totals.fat <= goals.fat * 1.3,
  };
}

async function todayPayload(user) {
  const date = todayUtc();
  const items = await prisma.foodLog.findMany({
    where: { userId: user.id, date },
    orderBy: { loggedAt: 'asc' },
  });
  const totals = sumItems(items);
  const goals = goalsOf(user);
  return {
    date: date.toISOString().slice(0, 10),
    goals,
    totals,
    health: healthMeter(totals, goals),
    goalsMet: goalsMet(totals, goals),
    items,
  };
}

// GET /food/today — today's log, totals, goals, and the health meter.
router.get('/today', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    res.json(await todayPayload(user));
  } catch (err) {
    next(err);
  }
});

// POST /food/log — { name, calories, protein?, carbs?, fat? } → adds an item.
router.post('/log', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    const { name, calories, protein, carbs, fat } = req.body || {};
    const cal = parseInt(calories, 10);
    if (!name || !Number.isFinite(cal) || cal < 0 || cal > 20000) {
      return res.status(400).json({ error: 'name and calories (0-20000) required' });
    }
    const clamp = (v, max) => Math.max(0, Math.min(max, parseInt(v, 10) || 0));
    await prisma.foodLog.create({
      data: {
        userId: user.id,
        name: String(name).slice(0, 120),
        calories: cal,
        protein: clamp(protein, 1000),
        carbs: clamp(carbs, 2000),
        fat: clamp(fat, 1000),
        date: todayUtc(),
      },
    });
    res.status(201).json(await todayPayload(user));
  } catch (err) {
    next(err);
  }
});

// GET /food/calendar?month=YYYY-MM — per-day rollup: macro totals, goals-met
// flags, health score, workout/challenge counts. Compact by design (the app's
// calendar cells are small); the tap-through detail lives at /food/day/:date.
router.get('/calendar', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : new Date().toISOString().slice(0, 7);
    const start = new Date(`${month}-01`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const [foods, sessions, completed] = await Promise.all([
      prisma.foodLog.findMany({ where: { userId: user.id, date: { gte: start, lt: end } } }),
      prisma.workoutSession.findMany({
        where: { userId: user.id, startedAt: { gte: start, lt: end } },
        select: { startedAt: true },
      }),
      prisma.userChallenge.findMany({
        where: { userId: user.id, completedAt: { gte: start, lt: end } },
        select: { completedAt: true },
      }),
    ]);

    const goals = goalsOf(user);
    const byDay = {};
    const dayOf = (d) => d.toISOString().slice(0, 10);
    for (const f of foods) {
      const k = dayOf(f.date);
      (byDay[k] = byDay[k] || { items: [], workouts: 0, challenges: 0 }).items.push(f);
    }
    for (const s of sessions) {
      const k = dayOf(s.startedAt);
      (byDay[k] = byDay[k] || { items: [], workouts: 0, challenges: 0 }).workouts++;
    }
    for (const c of completed) {
      const k = dayOf(c.completedAt);
      (byDay[k] = byDay[k] || { items: [], workouts: 0, challenges: 0 }).challenges++;
    }

    const days = Object.entries(byDay)
      .map(([date, d]) => {
        const totals = sumItems(d.items);
        return {
          date,
          totals,
          goalsMet: goalsMet(totals, goals),
          health: d.items.length ? healthMeter(totals, goals).score : null,
          workouts: d.workouts,
          challenges: d.challenges,
        };
      })
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    res.json({ month, goals, days });
  } catch (err) {
    next(err);
  }
});

// GET /food/day/:date — everything that happened on one day (tap-through detail).
router.get('/day/:date', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.date)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }
    const day = new Date(req.params.date);
    const next_ = new Date(day);
    next_.setUTCDate(next_.getUTCDate() + 1);

    const [items, sessions, completed] = await Promise.all([
      prisma.foodLog.findMany({ where: { userId: user.id, date: day }, orderBy: { loggedAt: 'asc' } }),
      prisma.workoutSession.findMany({
        where: { userId: user.id, startedAt: { gte: day, lt: next_ } },
        include: { sets: { select: { exerciseId: true, xpAwarded: true } } },
      }),
      prisma.userChallenge.findMany({
        where: { userId: user.id, completedAt: { gte: day, lt: next_ } },
        include: { challenge: { select: { title: true, kind: true, rewardPts: true } } },
      }),
    ]);

    const goals = goalsOf(user);
    const totals = sumItems(items);
    const workouts = sessions.map((s) => {
      const exercises = [...new Set(s.sets.map((x) => x.exerciseId))];
      let xp = 0;
      for (const set of s.sets) {
        if (set.xpAwarded) for (const v of Object.values(set.xpAwarded)) xp += v;
      }
      return { startedAt: s.startedAt, exercises: exercises.length, sets: s.sets.length, xp };
    });

    res.json({
      date: req.params.date,
      goals,
      totals,
      health: items.length ? healthMeter(totals, goals) : null,
      goalsMet: goalsMet(totals, goals),
      items,
      workouts,
      challenges: completed.map((c) => ({
        title: c.challenge.title,
        kind: c.challenge.kind,
        rewardPts: c.challenge.rewardPts,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    const item = await prisma.foodLog.findUnique({ where: { id: req.params.id } });
    if (!item || item.userId !== user.id) return res.status(404).json({ error: 'Not found' });
    await prisma.foodLog.delete({ where: { id: item.id } });
    res.json(await todayPayload(user));
  } catch (err) {
    next(err);
  }
});

// POST /food/goals — { calorieGoal?, proteinGoal?, carbGoal?, fatGoal? }.
router.post('/goals', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    const data = {};
    const take = (key, min, max) => {
      const v = parseInt(req.body?.[key], 10);
      if (Number.isFinite(v) && v >= min && v <= max) data[key] = v;
    };
    take('calorieGoal', 800, 10000);
    take('proteinGoal', 20, 500);
    take('carbGoal', 20, 1500);
    take('fatGoal', 10, 400);
    if (!Object.keys(data).length) return res.status(400).json({ error: 'No valid goals provided' });
    const updated = await prisma.user.update({ where: { id: user.id }, data });
    res.json(await todayPayload(updated));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.healthMeter = healthMeter; // exported for unit tests
module.exports.goalsMet = goalsMet;
