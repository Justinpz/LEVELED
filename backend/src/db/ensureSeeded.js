'use strict';

/**
 * Auto-seed reference data on server boot when the database isn't fully populated.
 *
 * Runs after the HTTP server is already listening (non-blocking) so the health
 * check passes immediately and a slow/failed seed can never take the service down.
 * All three seeds are idempotent upserts, so re-running is safe — but we gate on a
 * cheap sentinel check so normal boots skip straight past it.
 *
 * The exercise sentinel matters: Phase 1 left 873 exercise rows WITHOUT the
 * primary/secondary body-part fields the XP engine needs. "Rows exist" is not
 * enough — we re-seed until at least one row has been backfilled with the 70/30 data.
 *
 * Disable with AUTO_SEED=false (e.g. if you prefer to seed manually).
 */

const prisma = require('./prisma');
const seedExercises = require('./seed');
const seedGear = require('./seed_gear');
const seedChallenges = require('./seed_challenges');
const seedPrograms = require('./seed_programs');

async function needsSeed() {
  const [exerciseCount, backfilled, gearCount, challengeCount] = await Promise.all([
    prisma.exercise.count(),
    prisma.exercise.findFirst({
      where: { primaryBodyParts: { isEmpty: false } },
      select: { id: true },
    }),
    prisma.gearItem.count(),
    prisma.challenge.count(),
  ]);
  const exercisesNeedSeed = exerciseCount === 0 || !backfilled; // missing, or not yet backfilled
  return exercisesNeedSeed || gearCount === 0 || challengeCount === 0;
}

async function ensureSeeded() {
  if (process.env.AUTO_SEED === 'false') {
    console.log('[seed] auto-seed disabled (AUTO_SEED=false)');
    return;
  }

  let need;
  try {
    need = await needsSeed();
  } catch (err) {
    // DB not reachable yet / migrations mid-flight — don't crash the server.
    console.error('[seed] auto-seed sentinel check failed, skipping:', err.message);
    return;
  }

  if (!need) {
    console.log('[seed] reference data already present; skipping auto-seed');
  } else {
    console.log('[seed] database not fully seeded — auto-seeding reference data...');
    try {
      const ex = await seedExercises.run();
      const gear = await seedGear.run();
      const ch = await seedChallenges.run();
      console.log(
        `[seed] auto-seed complete: ${ex.count} exercises, ${gear.count} gear, ${ch.count} challenges`
      );
    } catch (err) {
      console.error('[seed] auto-seed failed (server still running):', err.message);
    }
  }

  // Starter programs seed independently (added after the original sentinel; a
  // fully-seeded production DB still needs these on first deploy of this code).
  try {
    const programCount = await prisma.program.count({ where: { isStarter: true } });
    if (programCount === 0) await seedPrograms.run();
  } catch (err) {
    console.error('[seed] starter-programs check failed (server still running):', err.message);
  }

  // Independent of reference data: every /game/* endpoint resolves an acting user
  // (auth stub = first user row), so an empty users table makes the whole API 404.
  // Guarantee one starter player exists until real auth lands.
  try {
    await ensureStarterUser();
  } catch (err) {
    console.error('[seed] starter-user check failed (server still running):', err.message);
  }
}

async function ensureStarterUser() {
  const userCount = await prisma.user.count();
  if (userCount > 0) return;
  const user = await prisma.user.create({
    data: { email: 'player1@leveled.local' },
  });
  console.log(`[seed] users table was empty — created starter player ${user.id}`);
}

module.exports = { ensureSeeded, needsSeed, ensureStarterUser };
