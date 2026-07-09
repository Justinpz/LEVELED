'use strict';

/**
 * Challenge endpoints — daily/weekly special tasks (master doc Part 8) plus
 * The Daily Warrior book session of the day.
 *
 * /daily and /weekly serve THREE challenges per period (deterministic per
 * date/week), each annotated with the caller's completed state. The legacy
 * `challenge` field carries the first pick so older clients keep working.
 */

const express = require('express');
const prisma = require('../db/prisma');
const challenges = require('../services/challenges');
const dailyWarrior = require('../services/dailyWarrior');

const router = express.Router();

const DAILY_COUNT = 3;
const WEEKLY_COUNT = 3;

async function resolveUserId(req) {
  return (
    req.header('x-user-id') ||
    (await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } }))?.id ||
    null
  );
}

router.get('/daily', async (req, res, next) => {
  try {
    const userId = await resolveUserId(req);
    const list = await challenges.serveMany('daily', DAILY_COUNT, userId);
    res.json({ date: challenges.dayKey(), challenges: list, challenge: list[0] || null });
  } catch (err) {
    next(err);
  }
});

router.get('/weekly', async (req, res, next) => {
  try {
    const userId = await resolveUserId(req);
    const list = await challenges.serveMany('weekly', WEEKLY_COUNT, userId);
    res.json({ week: challenges.weekKey(), challenges: list, challenge: list[0] || null });
  } catch (err) {
    next(err);
  }
});

// GET /challenges/warrior — today's Daily Warrior book session (randomized per date).
router.get('/warrior', async (req, res, next) => {
  try {
    const userId = await resolveUserId(req);
    res.json(await dailyWarrior.getToday(userId));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /challenges/:id/complete — award the reward to the tagged body part(s).
// Works for daily, weekly, and warrior challenge rows alike.
router.post('/:id/complete', async (req, res, next) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(404).json({ error: 'No user' });
    const result = await challenges.complete(userId, req.params.id);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
