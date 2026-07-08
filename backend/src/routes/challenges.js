'use strict';

/**
 * Challenge endpoints — daily/weekly special tasks (master doc Part 8).
 */

const express = require('express');
const prisma = require('../db/prisma');
const challenges = require('../services/challenges');

const router = express.Router();

router.get('/daily', async (req, res, next) => {
  try {
    const challenge = await challenges.serve('daily');
    res.json({ date: challenges.dayKey(), challenge });
  } catch (err) {
    next(err);
  }
});

router.get('/weekly', async (req, res, next) => {
  try {
    const challenge = await challenges.serve('weekly');
    res.json({ week: challenges.weekKey(), challenge });
  } catch (err) {
    next(err);
  }
});

// POST /challenges/:id/complete — award the reward to the tagged body part(s).
router.post('/:id/complete', async (req, res, next) => {
  try {
    const userId = req.header('x-user-id') || (await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } }))?.id;
    if (!userId) return res.status(404).json({ error: 'No user' });
    const result = await challenges.complete(userId, req.params.id);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
