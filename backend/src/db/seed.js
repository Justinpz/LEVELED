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

const DATA_PATH = path.resolve(__dirname, '../../../data/exercises_leveled.json');

async function main() {
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`Exercise data file not found at ${DATA_PATH}`);
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
}

main()
  .catch((err) => {
    console.error('[seed] Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
