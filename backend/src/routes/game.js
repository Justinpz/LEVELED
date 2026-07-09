'use strict';

/**
 * Core game-loop endpoints — the workouts→growth spine (master doc Parts 2, 5, 16).
 *
 * Auth note: real auth lands in Phase 2. For now the acting user is resolved from
 * the `x-user-id` header, falling back to the first user row (single-player dev).
 * Swap resolveUser() for session/JWT auth when it exists.
 */

const express = require('express');
const prisma = require('../db/prisma');
const xp = require('../lib/xp');

const router = express.Router();

const BODY_PARTS = xp.CATEGORY_ORDER; // Arms, Legs, Chest, Back, Core
// Gear tier -> body-part level gate (master doc Part 5).
const TIER_LEVEL_GATE = { iron: 1, mythic: 21, celestial: 41, abyssal: 61, ascendant: 81 };

async function resolveUser(req) {
  const headerId = req.header('x-user-id');
  if (headerId) return prisma.user.findUnique({ where: { id: headerId } });
  return prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
}

// Ensure the 5 body-part progress rows exist; return them keyed by body part.
async function ensureProgress(userId) {
  const rows = await prisma.bodyPartProgress.findMany({ where: { userId } });
  const have = new Set(rows.map((r) => r.bodyPart));
  const missing = BODY_PARTS.filter((bp) => !have.has(bp));
  if (missing.length) {
    await prisma.bodyPartProgress.createMany({
      data: missing.map((bp) => ({ userId, bodyPart: bp })),
      skipDuplicates: true,
    });
    return ensureProgress(userId);
  }
  return Object.fromEntries(rows.map((r) => [r.bodyPart, r]));
}

// GET /game/progress — 5 body-part tracks + derived level/next-level info.
router.get('/progress', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    const progress = await ensureProgress(user.id);
    const out = BODY_PARTS.map((bp) => {
      const p = progress[bp];
      const level = xp.levelForXp(p.lifetimeXp);
      return {
        bodyPart: bp,
        level,
        lifetimeXp: p.lifetimeXp,
        spendablePoints: p.spendablePoints,
        nextLevelXp: level < xp.MAX_LEVEL ? xp.xpForLevel(level + 1) : null,
        band: xp.levelBandLabel(level),
      };
    });
    res.json({
      userId: user.id,
      charClass: user.charClass,
      currentStreak: user.currentStreak,
      progress: out,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /game/workouts/log
 * body: {
 *   programDayId?, durationSeconds?,
 *   exercises: [{ exerciseId, isHeavy?, sets: [{ weight?, reps?, rpe?, notes? }] }]
 * }
 * Awards 100 base pts per completed exercise (70/30 split + Warrior bonuses),
 * updates body-part progress, returns the XP tally and any level-ups.
 */
router.post('/workouts/log', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    const { programDayId, durationSeconds, exercises } = req.body || {};
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ error: 'exercises[] required' });
    }

    const ids = exercises.map((e) => e.exerciseId);
    const exRows = await prisma.exercise.findMany({ where: { id: { in: ids } } });
    const exById = Object.fromEntries(exRows.map((e) => [e.id, e]));
    const missing = ids.filter((id) => !exById[id]);
    if (missing.length) return res.status(400).json({ error: 'Unknown exerciseId(s)', missing });

    // Aggregate XP per body part across all completed exercises.
    const totals = {};
    const perExercise = [];
    for (const e of exercises) {
      const ex = exById[e.exerciseId];
      const award = xp.pointsForExercise(ex, { charClass: user.charClass, isHeavy: !!e.isHeavy });
      perExercise.push({ exerciseId: e.exerciseId, award });
      for (const [bp, pts] of Object.entries(award)) totals[bp] = (totals[bp] || 0) + pts;
    }

    const progress = await ensureProgress(user.id);
    const levelUps = [];

    await prisma.$transaction(async (tx) => {
      const session = await tx.workoutSession.create({
        data: {
          userId: user.id,
          programDayId: programDayId || null,
          completedAt: new Date(),
          durationSeconds: durationSeconds || null,
        },
      });
      for (const e of exercises) {
        const award = perExercise.find((p) => p.exerciseId === e.exerciseId).award;
        for (const s of e.sets || [{}]) {
          await tx.loggedSet.create({
            data: {
              sessionId: session.id,
              exerciseId: e.exerciseId,
              weight: s.weight ?? null,
              reps: s.reps ?? null,
              rpe: s.rpe ?? null,
              notes: s.notes ?? null,
              xpAwarded: award,
            },
          });
        }
      }
      for (const [bp, pts] of Object.entries(totals)) {
        const p = progress[bp];
        const result = xp.applyXp(p.lifetimeXp, pts);
        await tx.bodyPartProgress.update({
          where: { id: p.id },
          data: {
            lifetimeXp: result.lifetimeXp,
            spendablePoints: p.spendablePoints + pts,
            level: result.newLevel,
          },
        });
        if (result.leveledUp) {
          levelUps.push({
            bodyPart: bp,
            from: result.oldLevel,
            to: result.newLevel,
            band: xp.levelBandLabel(result.newLevel),
          });
        }
      }
      // Streak bookkeeping: at most one increment per calendar day; consecutive
      // days extend the streak, a missed day resets it to 1.
      const today = new Date().toISOString().slice(0, 10);
      const last = user.lastWorkoutDate ? user.lastWorkoutDate.toISOString().slice(0, 10) : null;
      if (last !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const nextStreak = last === yesterday ? user.currentStreak + 1 : 1;
        await tx.user.update({
          where: { id: user.id },
          data: { lastWorkoutDate: new Date(), currentStreak: nextStreak },
        });
      }
    });

    res.json({ tally: totals, perExercise, levelUps });
  } catch (err) {
    next(err);
  }
});

// GET /game/exercises — library with filters (Screen 8).
// query: bodyPart, equipment, level (difficulty), mechanic, search, take, skip
router.get('/exercises', async (req, res, next) => {
  try {
    const { bodyPart, equipment, level, mechanic, search } = req.query;
    const where = {};
    if (bodyPart) where.bodyParts = { has: bodyPart };
    if (equipment) where.equipment = equipment;
    if (level) where.level = level;
    if (mechanic) where.mechanic = mechanic;
    if (search) where.name = { contains: String(search), mode: 'insensitive' };
    const take = Math.min(parseInt(req.query.take || '50', 10), 200);
    const skip = parseInt(req.query.skip || '0', 10);
    const [items, total] = await Promise.all([
      prisma.exercise.findMany({ where, take, skip, orderBy: { name: 'asc' } }),
      prisma.exercise.count({ where }),
    ]);
    res.json({ total, take, skip, items });
  } catch (err) {
    next(err);
  }
});

// GET /game/shop — gear grouped by slot, with locked state from the user's levels.
router.get('/shop', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    const progress = await ensureProgress(user.id);
    const levelBySlot = {
      arms: xp.levelForXp(progress.Arms.lifetimeXp),
      legs: xp.levelForXp(progress.Legs.lifetimeXp),
      chest: xp.levelForXp(progress.Chest.lifetimeXp),
      back: xp.levelForXp(progress.Back.lifetimeXp),
      core: xp.levelForXp(progress.Core.lifetimeXp),
    };
    const pointsBySlot = {
      arms: progress.Arms.spendablePoints,
      legs: progress.Legs.spendablePoints,
      chest: progress.Chest.spendablePoints,
      back: progress.Back.spendablePoints,
      core: progress.Core.spendablePoints,
    };
    const totalPoints = Object.values(pointsBySlot).reduce((a, b) => a + b, 0);
    const userGear = await prisma.userGear.findMany({ where: { userId: user.id } });
    const gearState = new Map(userGear.map((g) => [g.gearItemId, g]));
    const items = await prisma.gearItem.findMany({ orderBy: [{ slot: 'asc' }, { costPts: 'asc' }] });
    // Horizon rule: show what's buyable now plus what unlocks within the next
    // 10 levels of that slot — far tiers stay hidden until you approach them.
    // Owned items always show regardless of gate.
    const SHOP_LEVEL_HORIZON = 10;
    const shaped = items
      .map((it) => {
        const gate = TIER_LEVEL_GATE[it.tier] ?? it.levelGate ?? 1;
        const rec = gearState.get(it.id);
        return {
          ...it,
          levelGate: gate,
          locked: levelBySlot[it.slot] < gate,
          owned: !!(rec && rec.owned),
          equipped: !!(rec && rec.equipped),
        };
      })
      .filter((it) => it.owned || it.levelGate <= levelBySlot[it.slot] + SHOP_LEVEL_HORIZON);
    res.json({ levelBySlot, pointsBySlot, totalPoints, items: shaped });
  } catch (err) {
    next(err);
  }
});

// POST /game/gear/:id/buy — spend points from that slot's pool.
router.post('/gear/:id/buy', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    const item = await prisma.gearItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Unknown gear item' });
    const progress = await ensureProgress(user.id);
    const slotPart = item.slot.charAt(0).toUpperCase() + item.slot.slice(1); // arms->Arms
    const p = progress[slotPart];
    const gate = TIER_LEVEL_GATE[item.tier] ?? item.levelGate ?? 1;
    if (xp.levelForXp(p.lifetimeXp) < gate) {
      return res.status(403).json({ error: 'Locked', requiredLevel: gate, slot: item.slot });
    }
    if (p.spendablePoints < item.costPts) {
      return res.status(402).json({ error: 'Not enough points', need: item.costPts, have: p.spendablePoints });
    }
    const result = await prisma.$transaction(async (tx) => {
      await tx.bodyPartProgress.update({
        where: { id: p.id },
        data: { spendablePoints: p.spendablePoints - item.costPts },
      });
      return tx.userGear.upsert({
        where: { userId_gearItemId: { userId: user.id, gearItemId: item.id } },
        create: { userId: user.id, gearItemId: item.id, owned: true },
        update: { owned: true },
      });
    });
    res.json({ purchased: item.id, spent: item.costPts, userGear: result });
  } catch (err) {
    next(err);
  }
});

// POST /game/gear/:id/unequip — take an equipped item off.
router.post('/gear/:id/unequip', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    const rec = await prisma.userGear.findUnique({
      where: { userId_gearItemId: { userId: user.id, gearItemId: req.params.id } },
    });
    if (!rec || !rec.owned) return res.status(403).json({ error: 'Not owned' });
    await prisma.userGear.update({ where: { id: rec.id }, data: { equipped: false } });
    res.json({ unequipped: req.params.id });
  } catch (err) {
    next(err);
  }
});

// POST /game/gear/:id/equip — equip an owned item (one per slot).
router.post('/gear/:id/equip', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    const item = await prisma.gearItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Unknown gear item' });
    const owned = await prisma.userGear.findUnique({
      where: { userId_gearItemId: { userId: user.id, gearItemId: item.id } },
    });
    if (!owned || !owned.owned) return res.status(403).json({ error: 'Not owned' });
    await prisma.$transaction(async (tx) => {
      // Unequip other items in the same slot.
      const slotItemIds = (await tx.gearItem.findMany({ where: { slot: item.slot }, select: { id: true } })).map((g) => g.id);
      await tx.userGear.updateMany({
        where: { userId: user.id, gearItemId: { in: slotItemIds } },
        data: { equipped: false },
      });
      await tx.userGear.update({
        where: { userId_gearItemId: { userId: user.id, gearItemId: item.id } },
        data: { equipped: true },
      });
    });
    res.json({ equipped: item.id, slot: item.slot });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
