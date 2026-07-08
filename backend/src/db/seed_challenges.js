'use strict';

/**
 * Seed the `challenges` pool from data/challenges.json (master doc Part 8).
 *
 * Idempotent upsert by (kind, title) — never deletes. A delete-and-recreate approach
 * would cascade-delete every UserChallenge completion record tied to the old rows
 * (onDelete: Cascade), silently wiping player history on every re-seed.
 *
 * Usage:  node src/db/seed_challenges.js
 */

const fs = require('fs');
const path = require('path');
const prisma = require('./prisma');

const DATA_PATH = path.resolve(__dirname, '../../../data/challenges.json');

async function run() {
  const pool = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  console.log(`[seed_challenges] Read ${pool.length} challenges`);

  let created = 0;
  let updated = 0;
  for (const c of pool) {
    const data = {
      kind: c.kind,
      difficulty: c.difficulty,
      title: c.title,
      description: c.description ?? null,
      rewardPts: c.rewardPts,
      bodyPartTargets: c.bodyPartTargets || [],
      criteria: c.criteria ?? undefined,
    };
    const existing = await prisma.challenge.findFirst({ where: { kind: c.kind, title: c.title } });
    if (existing) {
      await prisma.challenge.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.challenge.create({ data });
      created++;
    }
  }

  const count = await prisma.challenge.count();
  console.log(`Seeded ${count} challenges (${created} created, ${updated} updated)`);
  return { count, created, updated };
}

module.exports = { run };

if (require.main === module) {
  run()
    .catch((err) => {
      console.error('[seed_challenges] Failed:', err.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
