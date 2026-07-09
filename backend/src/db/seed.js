'use strict';

/**
 * Seed the `exercises` table from data/exercises_leveled.json.
 *
 * Idempotent: re-running upserts existing rows. Safe to run multiple times.
 * Expected end state: 873 rows, distributed across 5 body_parts
 * (Arms, Back, Chest, Core, Legs).
 *
 * Usage:  npm run db:seed
 */

const fs = require('fs');
const path = require('path');
const prisma = require('./prisma');

// backend/data ships in the deployed container (Railway root dir = /backend);
// the repo-root copy only exists in a full checkout. Prefer the shipped one.
const DATA_CANDIDATES = [
  path.resolve(__dirname, '../../data/exercises_leveled.json'),
  path.resolve(__dirname, '../../../data/exercises_leveled.json'),
];
const DATA_PATH = DATA_CANDIDATES.find((p) => fs.existsSync(p));

async function run() {
  if (!DATA_PATH) {
    throw new Error(`Exercise data file not found; tried ${DATA_CANDIDATES.join(', ')}`);
  }

  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  console.log(`[seed] Read ${raw.length} exercises from data/exercises_leveled.json`);

  // Map camelCase JSON → Prisma model field names (Prisma handles snake_case columns).
  const records = raw.map((e) => ({
    id: e.id,
    name: e.name,
    level: e.level ?? null,
    force: e.force ?? null,
    mechanic: e.mechanic ?? null,
    equipment: e.equipment ?? null,
    category: e.category ?? null,
    primaryMuscles: Array.isArray(e.primaryMuscles) ? e.primaryMuscles : [],
    secondaryMuscles: Array.isArray(e.secondaryMuscles) ? e.secondaryMuscles : [],
    // Primary-70/Secondary-30 split — the XP engine reads these; without them
    // every exercise awards zero XP.
    primaryBodyParts: Array.isArray(e.primaryBodyParts) ? e.primaryBodyParts : [],
    secondaryBodyParts: Array.isArray(e.secondaryBodyParts) ? e.secondaryBodyParts : [],
    bodyParts: Array.isArray(e.bodyParts) ? e.bodyParts : [],
    instructions: Array.isArray(e.instructions) ? e.instructions : [],
    images: Array.isArray(e.images) ? e.images : [],
  }));

  let i = 0;
  for (const r of records) {
    await prisma.exercise.upsert({
      where: { id: r.id },
      create: r,
      update: r,
    });
    i++;
    if (i % 100 === 0) {
      console.log(`[seed] ${i}/${records.length}...`);
    }
  }

  const count = await prisma.exercise.count();
  console.log(`Seeded ${count} exercises`);

  if (count !== raw.length) {
    console.warn(
      `[seed] WARNING: row count (${count}) differs from JSON length (${raw.length})`
    );
  }

  return { count };
}

module.exports = { run };

// CLI entrypoint: `node src/db/seed.js`. Not executed when imported (e.g. by the
// admin seed route), so the shared Prisma client stays connected for the server.
if (require.main === module) {
  run()
    .catch((err) => {
      console.error('[seed] Failed:', err.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
