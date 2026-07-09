'use strict';

/**
 * Workout programs — the "suggest from" library + AI builder (master doc Part 16).
 */

const express = require('express');
const prisma = require('../db/prisma');
const aiBuilder = require('../services/aiBuilder');
const localBuilder = require('../services/localBuilder');

const router = express.Router();

async function resolveUser(req) {
  const headerId = req.header('x-user-id');
  if (headerId) return prisma.user.findUnique({ where: { id: headerId } });
  return prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
}

// GET /programs — list starters + the acting user's own programs.
router.get('/', async (req, res, next) => {
  try {
    const userId = req.header('x-user-id') || null;
    const programs = await prisma.program.findMany({
      where: { OR: [{ isStarter: true }, { isPublic: true }, userId ? { ownerId: userId } : {}] },
      include: { days: { select: { id: true, dayNumber: true, name: true, isRest: true, bodyParts: true } } },
      orderBy: [{ isStarter: 'desc' }, { name: 'asc' }],
    });
    res.json({ programs });
  } catch (err) {
    next(err);
  }
});

// GET /programs/active — the user's selected program (drives the Workout screen).
router.get('/active', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    if (!user.activeProgramId) return res.json({ program: null });
    const program = await prisma.program.findUnique({
      where: { id: user.activeProgramId },
      include: {
        days: {
          include: { exercises: { include: { exercise: { select: { id: true, name: true, equipment: true, primaryBodyParts: true } } } } },
          orderBy: { dayNumber: 'asc' },
        },
      },
    });
    // Suggest the next day: count this program's completed sessions and rotate.
    let suggestedDay = null;
    if (program) {
      const dayIds = program.days.map((d) => d.id);
      const done = await prisma.workoutSession.count({
        where: { userId: user.id, programDayId: { in: dayIds } },
      });
      const trainDays = program.days.filter((d) => !d.isRest);
      if (trainDays.length) suggestedDay = trainDays[done % trainDays.length].dayNumber;
    }
    res.json({ program, suggestedDay });
  } catch (err) {
    next(err);
  }
});

// POST /programs/:id/select — make this the active program ("" clears via /clear).
router.post('/:id/select', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    const program = await prisma.program.findUnique({ where: { id: req.params.id } });
    if (!program) return res.status(404).json({ error: 'Not found' });
    await prisma.user.update({ where: { id: user.id }, data: { activeProgramId: program.id } });
    res.json({ selected: program.id, name: program.name });
  } catch (err) {
    next(err);
  }
});

// POST /programs/clear — drop the active program (back to free workouts).
router.post('/clear', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: 'No user' });
    await prisma.user.update({ where: { id: user.id }, data: { activeProgramId: null } });
    res.json({ selected: null });
  } catch (err) {
    next(err);
  }
});

// GET /programs/:id — full program with days + exercises.
router.get('/:id', async (req, res, next) => {
  try {
    const program = await prisma.program.findUnique({
      where: { id: req.params.id },
      include: { days: { include: { exercises: true }, orderBy: { dayNumber: 'asc' } } },
    });
    if (!program) return res.status(404).json({ error: 'Not found' });
    res.json({ program });
  } catch (err) {
    next(err);
  }
});

// POST /programs — persist a manually built (or reviewed AI) program.
// body: { name, description, durationWeeks, daysPerWeek, isPublic?, days:[{dayNumber,name,isRest,bodyParts,exercises:[...]}] }
router.post('/', async (req, res, next) => {
  try {
    const userId = req.header('x-user-id') || null;
    const p = req.body || {};
    if (!p.name || !Array.isArray(p.days)) return res.status(400).json({ error: 'name and days[] required' });
    const created = await prisma.program.create({
      data: {
        name: p.name,
        description: p.description || null,
        durationWeeks: p.durationWeeks || 1,
        daysPerWeek: p.daysPerWeek || p.days.filter((d) => !d.isRest).length,
        isPublic: !!p.isPublic,
        ownerId: userId,
        days: {
          create: p.days.map((d) => ({
            dayNumber: d.dayNumber,
            name: d.name,
            isRest: !!d.isRest,
            bodyParts: d.bodyParts || [],
            exercises: {
              create: (d.exercises || []).map((e) => ({
                exerciseId: e.exerciseId,
                series: e.series,
                orderInSeries: e.orderInSeries,
                sets: e.sets,
                reps: String(e.reps),
                restSeconds: e.restSeconds,
                rpe: e.rpe ?? null,
                supersetGroup: e.supersetGroup ?? null,
                notes: e.notes ?? null,
              })),
            },
          })),
        },
      },
      include: { days: { include: { exercises: true } } },
    });
    res.status(201).json({ program: created });
  } catch (err) {
    next(err);
  }
});

// POST /programs/ai-generate — build a structured program from a free-text goal.
// Uses Claude when ANTHROPIC_API_KEY is configured; otherwise (or if the AI call
// fails) falls back to the rule-based generator so the button always works.
router.post('/ai-generate', async (req, res, next) => {
  try {
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_MODEL) {
      try {
        const result = await aiBuilder.generateProgram(req.body || {});
        return res.json({ ...result, generator: 'ai' });
      } catch (err) {
        console.error('[programs] AI generate failed, using rule-based fallback:', err.message);
      }
    }
    const result = await localBuilder.generateProgram(req.body || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /programs/ai-validate — Claude critiques a user-built workout's structure.
router.post('/ai-validate', async (req, res, next) => {
  try {
    const result = await aiBuilder.validateWorkout(req.body || {});
    res.json(result);
  } catch (err) {
    if (err.status === 503) return res.status(503).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
