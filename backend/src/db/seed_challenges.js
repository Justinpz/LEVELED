'use strict';

/**
 * Seed the `challenges` pool from data/challenges.json (master doc Part 8).
 * Idempotent: clears the pool and reinserts (small, static reference data).
 *
 * Usage:  node src/db/seed_challenges.js
 */

const fs = require('fs');
const path = require('path');
const prisma = require('./prisma');

const DATA_PATH = path.resolve(__dirname, '../../../data/challenges.json');

async function main() {
  const pool = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  console.log(`[seed_challenges] Read ${pool.length} challenges`);
  await prisma.challenge.deleteMany({});
  await prisma.challenge.createMany({
    data: pool.map((c) => ({
      kind: c.kind,
      difficulty: c.difficulty,
      title: c.title,
      description: c.description ?? null,
      rewardPts: c.rewardPts,
      bodyPartTargets: c.bodyPartTargets || [],
      criteria: c.criteria ?? undefined,
    })),
  });
  const count = await prisma.challenge.count();
  console.log(`Seeded ${count} challenges`);
}

main()
  .catch((err) => {
    console.error('[seed_challenges] Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
