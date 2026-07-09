'use strict';

/**
 * Food tracker + health meter.
 *
 * Log what you eat; the health meter (0-100) moves with intake vs the user's
 * calorie/protein goals:
 *   - calories fill the meter as you approach the goal, then drain it when you
 *     blow well past it (2 points lost per 1% overage)
 *   - protein contributes up to 40% of the meter, capped at the goal
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

function healthMeter(totals, goals) {
  const calRatio = goals.calories > 0 ? totals.calories / goals.calories : 0;
  const calScore =
    calRatio <= 1 ? calRatio * 100 : Math.max(0, 100 - (calRatio - 1) * 200);
  const proteinScore = goals.protein > 0 ? Math.min(1, totals.protein / goals.protein) * 100 : 100;
  const score = Math.round(0.6 * calScore + 0.4 * proteinScore);

  let label;
  if (calRatio > 1.15) label = 'Overfed';
  else if (score >= 90) label = 'Forged';
  else if (score >= 75) label = 'Battle-Ready';
  else if (score >= 50) label = 'Nourished';
  else if (score >= 25) label = 'Underfed';
  else label = 'Starving';

  return { score, label, calRatio: Math.round(calRatio * 100) / 100 };
}

async function todayPayload(user) {
  const date = todayUtc();
  const items = await prisma.foodLog.findMany({
    where: { userId: user.id, date },
    orderBy: { loggedAt: 'asc' },
  });
  const totals = items.reduce(
    (a, it) => ({ calories: a.calories + it.calories, protein: a.protein + it.protein }),
    { calories: 0, protein: 0 }
  );
  const goals = { calories: user.calorieGoal, protein: user.proteinGoal };
  return {
    date: date.toISOString().slice(0, 10),
    goals,
    totals,
    health: healthMeter(totals, goals),
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

// POST /food/log — { name, calories, protein? } → adds an item, returns the day.
router.post('/log', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    const { name, calories, protein } = req.body || {};
    const cal = parseInt(calories, 10);
    if (!name || !Number.isFinite(cal) || cal < 0 || cal > 20000) {
      return res.status(400).json({ error: 'name and calories (0-20000) required' });
    }
    const prot = Math.max(0, Math.min(1000, parseInt(protein, 10) || 0));
    await prisma.foodLog.create({
      data: { userId: user.id, name: String(name).slice(0, 120), calories: cal, protein: prot, date: todayUtc() },
    });
    res.status(201).json(await todayPayload(user));
  } catch (err) {
    next(err);
  }
});

// DELETE /food/:id — remove a logged item (own items only).
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

// POST /food/goals — { calorieGoal?, proteinGoal? } → update targets.
router.post('/goals', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    const data = {};
    const cg = parseInt(req.body?.calorieGoal, 10);
    const pg = parseInt(req.body?.proteinGoal, 10);
    if (Number.isFinite(cg) && cg >= 800 && cg <= 10000) data.calorieGoal = cg;
    if (Number.isFinite(pg) && pg >= 20 && pg <= 500) data.proteinGoal = pg;
    if (!Object.keys(data).length) return res.status(400).json({ error: 'No valid goals provided' });
    const updated = await prisma.user.update({ where: { id: user.id }, data });
    res.json(await todayPayload(updated));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.healthMeter = healthMeter; // exported for unit tests
