'use strict';

/**
 * The Daily Warrior — 365 book workouts served as a randomized daily challenge.
 *
 * Source: data/daily_warrior.json (owner-supplied book, parsed to
 * {day, quote, author, originalSession, homeEdition[]} entries). Each calendar
 * date hash-picks one of the 365 days, so the pick is random across dates but
 * stable within a date (everyone sees the same session all day).
 *
 * Completion reuses the Challenge/UserChallenge machinery: a Challenge row of
 * kind 'warrior' is lazily find-or-created per book day, so the standard
 * complete() reward + once-per-day guard apply unchanged.
 */

const fs = require('fs');
const path = require('path');
const prisma = require('../db/prisma');
const { dayKey, hashPick } = require('./challenges');

const REWARD_PTS = 150; // full-session home workout — pays more than a normal daily
const DATA_CANDIDATES = [
  path.resolve(__dirname, '../../data/daily_warrior.json'), // backend/data (deployed)
  path.resolve(__dirname, '../../../data/daily_warrior.json'), // repo root (dev)
];

let cache = null;
function loadBook() {
  if (cache) return cache;
  for (const p of DATA_CANDIDATES) {
    if (fs.existsSync(p)) {
      cache = JSON.parse(fs.readFileSync(p, 'utf8'));
      return cache;
    }
  }
  throw Object.assign(new Error('daily_warrior.json not found'), { status: 503 });
}

// Deterministic-random book day for a date key.
function entryForDate(key = dayKey()) {
  const book = loadBook();
  return book[hashPick(`warrior:${key}`, book.length)];
}

async function ensureChallengeRow(entry) {
  const title = `The Daily Warrior — Day ${entry.day}`;
  const existing = await prisma.challenge.findFirst({ where: { kind: 'warrior', title } });
  if (existing) return existing;
  return prisma.challenge.create({
    data: {
      kind: 'warrior',
      difficulty: 'hard',
      title,
      description: entry.quote ? `“${entry.quote}” — ${entry.author}` : null,
      rewardPts: REWARD_PTS,
      bodyPartTargets: [], // empty = reward splits across all five body parts
    },
  });
}

// Today's book session + this user's completion state.
async function getToday(userId) {
  const entry = entryForDate();
  const challenge = await ensureChallengeRow(entry);
  let completed = false;
  if (userId) {
    const uc = await prisma.userChallenge.findUnique({
      where: { userId_challengeId: { userId, challengeId: challenge.id } },
    });
    completed = !!(uc && uc.completedAt && dayKey(uc.completedAt) === dayKey());
  }
  return {
    date: dayKey(),
    bookDay: entry.day,
    quote: entry.quote,
    author: entry.author,
    originalSession: entry.originalSession,
    homeEdition: entry.homeEdition,
    rewardPts: challenge.rewardPts,
    challengeId: challenge.id,
    completed,
  };
}

module.exports = { getToday, entryForDate, ensureChallengeRow, REWARD_PTS };
