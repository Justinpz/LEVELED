'use strict';

/**
 * Workout programs — the "suggest from" library + AI builder (master doc Part 16).
 */

const express = require('express');
const prisma = require('../db/prisma');
const aiBuilder = require('../services/aiBuilder');

const router = express.Router();

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

// POST /programs/ai-generate — Claude builds a structured program from goals.
router.post('/ai-generate', async (req, res, next) => {
  try {
    const result = await aiBuilder.generateProgram(req.body || {});
    res.json(result);
  } catch (err) {
    if (err.status === 503) return res.status(503).json({ error: err.message });
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
