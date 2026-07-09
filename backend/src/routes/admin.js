'use strict';

/**
 * Ops endpoint for one-time / repeatable maintenance tasks that don't warrant a
 * full admin panel or shell access — primarily the initial data seed, so it can be
 * triggered from anywhere (e.g. no CLI access on a phone) via a single authenticated
 * HTTP call instead of `railway run`.
 *
 * Gated by ADMIN_SEED_KEY: unset -> always 403 (seeding is never reachable by
 * default). Set it in Railway env vars, redeploy, then call with the same value in
 * the x-admin-key header. All seed operations are idempotent upserts — safe to
 * call more than once.
 */

const express = require('express');
const seedExercises = require('../db/seed');
const seedGear = require('../db/seed_gear');
const seedChallenges = require('../db/seed_challenges');
const seedPrograms = require('../db/seed_programs');

const router = express.Router();

function requireAdminKey(req, res, next) {
  const configured = process.env.ADMIN_SEED_KEY;
  const provided = req.header('x-admin-key');
  if (!configured || !provided || provided !== configured) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// POST /admin/seed — load exercises + gear + challenges. Idempotent.
router.post('/seed', requireAdminKey, async (req, res, next) => {
  try {
    const exercises = await seedExercises.run();
    const gear = await seedGear.run();
    const challenges = await seedChallenges.run();
    const programs = await seedPrograms.run();
    res.json({ ok: true, exercises, gear, challenges, programs });
  } catch (err) {
    console.error('[admin/seed] Failed:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
