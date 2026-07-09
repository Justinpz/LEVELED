'use strict';

/**
 * Special tasks — daily/weekly challenges + streak bonuses (master doc Part 8).
 *
 * Serving: deterministic pick from the seeded pool by date, so a given day/week
 * always yields the same challenge for everyone (single-player MVP). Completion
 * routes the reward through the XP engine to the tagged body part(s).
 */

const prisma = require('../db/prisma');
const xp = require('../lib/xp');

// Deterministic index from a date key + pool size.
function hashPick(key, n) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return n ? h % n : 0;
}

// Deterministic pick of `count` distinct indices — a seeded Fisher-Yates prefix,
// so a given day/week always serves the same set to everyone.
function hashPickMany(key, n, count) {
  const idx = Array.from({ length: n }, (_, i) => i);
  let h = hashPick(key, 0xffffffff) || 1;
  const rand = () => {
    // mulberry32 — tiny deterministic PRNG seeded from the date key
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < Math.min(count, n); i++) {
    const j = i + Math.floor(rand() * (n - i));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, Math.min(count, n));
}

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function weekKey(d = new Date()) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

async function serve(kind) {
  const pool = await prisma.challenge.findMany({ where: { kind } });
  if (pool.length === 0) return null;
  const key = kind === 'daily' ? dayKey() : weekKey();
  return pool[hashPick(`${kind}:${key}`, pool.length)];
}

// Serve `count` distinct challenges for the period, each annotated with whether
// this user already completed it within the current serving period.
async function serveMany(kind, count, userId) {
  const pool = await prisma.challenge.findMany({ where: { kind }, orderBy: { title: 'asc' } });
  if (pool.length === 0) return [];
  const key = kind === 'daily' ? dayKey() : weekKey();
  const picks = hashPickMany(`${kind}:${key}`, pool.length, count).map((i) => pool[i]);

  let completedIds = new Set();
  if (userId) {
    const done = await prisma.userChallenge.findMany({
      where: { userId, challengeId: { in: picks.map((c) => c.id) }, completedAt: { not: null } },
    });
    completedIds = new Set(
      done
        .filter((d) => {
          const same = kind === 'weekly'
            ? weekKey(d.completedAt) === weekKey()
            : dayKey(d.completedAt) === dayKey();
          return same;
        })
        .map((d) => d.challengeId)
    );
  }
  return picks.map((c) => ({ ...c, completed: completedIds.has(c.id) }));
}

// Apply a challenge reward to the user's tagged body parts via the XP engine.
async function complete(userId, challengeId) {
  const [user, challenge] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.challenge.findUnique({ where: { id: challengeId } }),
  ]);
  if (!user) throw Object.assign(new Error('No user'), { status: 404 });
  if (!challenge) throw Object.assign(new Error('Unknown challenge'), { status: 404 });

  // One reward per serving period. The pool rotates deterministically, so the same
  // challenge can legitimately recur in a later day/week — but re-completing it
  // within the same period must not pay out again.
  const existing = await prisma.userChallenge.findUnique({
    where: { userId_challengeId: { userId, challengeId } },
  });
  if (existing && existing.completedAt) {
    // 'warrior' (Daily Warrior book) rotates daily, same as 'daily'.
    const samePeriod = challenge.kind === 'weekly'
      ? weekKey(existing.completedAt) === weekKey()
      : dayKey(existing.completedAt) === dayKey();
    if (samePeriod) {
      throw Object.assign(new Error('Challenge already completed'), { status: 409 });
    }
  }

  const targets = challenge.bodyPartTargets.length
    ? challenge.bodyPartTargets
    : xp.CATEGORY_ORDER; // "all body parts" challenges
  const per = Math.round(challenge.rewardPts / targets.length);

  const levelUps = [];
  await prisma.$transaction(async (tx) => {
    for (const bp of targets) {
      const row = await tx.bodyPartProgress.upsert({
        where: { userId_bodyPart: { userId, bodyPart: bp } },
        create: { userId, bodyPart: bp },
        update: {},
      });
      const result = xp.applyXp(row.lifetimeXp, per);
      await tx.bodyPartProgress.update({
        where: { id: row.id },
        data: { lifetimeXp: result.lifetimeXp, spendablePoints: row.spendablePoints + per, level: result.newLevel },
      });
      if (result.leveledUp) levelUps.push({ bodyPart: bp, from: result.oldLevel, to: result.newLevel });
    }
    await tx.userChallenge.upsert({
      where: { userId_challengeId: { userId, challengeId } },
      create: { userId, challengeId, status: 'completed', completedAt: new Date() },
      update: { status: 'completed', completedAt: new Date() },
    });
  });

  // 7-day daily streak unlocks the special Streak Shop (master doc Part 6).
  const streakShopUnlocked = user.currentStreak >= 7 && challenge.kind === 'daily';
  return { rewardPts: challenge.rewardPts, perBodyPart: per, targets, levelUps, streakShopUnlocked };
}

module.exports = { serve, serveMany, complete, dayKey, weekKey, hashPick, hashPickMany };
