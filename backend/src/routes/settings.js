'use strict';

/**
 * App settings — schemaless preferences stored on User.settings (JSONB).
 *
 * GET  /game/settings          → defaults merged with the user's saved values
 * PUT  /game/settings          → shallow-merge valid keys, return the result
 *
 * Only whitelisted keys are accepted, each validated, so a client can never
 * bloat or poison the settings blob.
 */

const express = require('express');
const prisma = require('../db/prisma');

const router = express.Router();

const DEFAULTS = {
  displayName: '', // shown under WARRIOR on the home hero
  units: 'lbs', // 'lbs' | 'kg' — workout weight fields
  barks: true, // avatar speaks when tapped
  animations: true, // breathing / bounce / equip pops (reduce-motion off switch)
  levelUpModal: true, // full-screen level-up celebration
  warriorShowOriginal: false, // Daily Warrior: open the original gym session by default
  restTimer: false, // auto rest countdown after adding a set
  restSeconds: 90, // default rest duration
};

const VALIDATORS = {
  displayName: (v) => typeof v === 'string' && v.length <= 24 && String(v),
  units: (v) => (v === 'lbs' || v === 'kg') && v,
  barks: (v) => typeof v === 'boolean' && v,
  animations: (v) => typeof v === 'boolean' && v,
  levelUpModal: (v) => typeof v === 'boolean' && v,
  warriorShowOriginal: (v) => typeof v === 'boolean' && v,
  restTimer: (v) => typeof v === 'boolean' && v,
  restSeconds: (v) => Number.isInteger(v) && v >= 15 && v <= 600 && v,
};

function merged(user) {
  return { ...DEFAULTS, ...(user.settings || {}) };
}

// Booleans need special handling: `false && v` is falsy but valid.
function sanitize(body) {
  const clean = {};
  for (const [key, validate] of Object.entries(VALIDATORS)) {
    if (!(key in (body || {}))) continue;
    const v = body[key];
    if (typeof DEFAULTS[key] === 'boolean') {
      if (typeof v === 'boolean') clean[key] = v;
    } else {
      const ok = validate(v);
      if (ok !== false && ok !== undefined) clean[key] = v;
    }
  }
  return clean;
}

async function resolveUser(req) {
  const headerId = req.header('x-user-id');
  if (headerId) return prisma.user.findUnique({ where: { id: headerId } });
  return prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
}

router.get('/', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    res.json({ settings: merged(user) });
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    const clean = sanitize(req.body);
    if (!Object.keys(clean).length) return res.status(400).json({ error: 'No valid settings provided' });
    const next_ = { ...(user.settings || {}), ...clean };
    const updated = await prisma.user.update({ where: { id: user.id }, data: { settings: next_ } });
    res.json({ settings: merged(updated) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.DEFAULTS = DEFAULTS;
module.exports.sanitize = sanitize;
