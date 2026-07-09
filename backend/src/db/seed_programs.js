'use strict';

/**
 * Seed the 10 starter programs from data/starter_programs.json.
 *
 * Non-destructive: a starter program is matched by name; existing ones are
 * left untouched (players may have sessions pointing at their days), missing
 * ones are created. Safe to run on every boot.
 */

const fs = require('fs');
const path = require('path');
const prisma = require('./prisma');

const DATA_CANDIDATES = [
  path.resolve(__dirname, '../../data/starter_programs.json'), // backend/data (deployed)
  path.resolve(__dirname, '../../../data/starter_programs.json'), // repo root (dev)
];

function loadPrograms() {
  for (const p of DATA_CANDIDATES) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  throw new Error('starter_programs.json not found');
}

async function run() {
  const programs = loadPrograms();
  let created = 0;
  let skipped = 0;

  for (const p of programs) {
    const existing = await prisma.program.findFirst({
      where: { isStarter: true, name: p.name },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.program.create({
      data: {
        name: p.name,
        description: p.description || null,
        durationWeeks: p.durationWeeks,
        daysPerWeek: p.daysPerWeek,
        designedBy: p.designedBy || 'LEVELED',
        isStarter: true,
        isPublic: true,
        days: {
          create: p.days.map((d) => ({
            dayNumber: d.dayNumber,
            name: d.name,
            isRest: !!d.isRest,
            bodyParts: d.bodyParts || [],
            exercises: {
              create: d.exercises.map((e) => ({
                exerciseId: e.exerciseId,
                series: e.series,
                orderInSeries: e.orderInSeries,
                sets: e.sets,
                reps: String(e.reps),
                restSeconds: e.restSeconds,
              })),
            },
          })),
        },
      },
    });
    created++;
  }

  console.log(`[seed] starter programs: ${created} created, ${skipped} already present`);
  return { count: created + skipped, created, skipped };
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] starter programs failed:', err);
      process.exit(1);
    });
}

module.exports = { run };
