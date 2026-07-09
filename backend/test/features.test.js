'use strict';

/**
 * Unit tests for the pure logic behind the July feature drop:
 * challenge multi-pick, Daily Warrior rotation, request parsing, health meter.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { hashPickMany, dayKey } = require('../src/services/challenges');
const { parseRequest } = require('../src/services/localBuilder');
const { healthMeter } = require('../src/routes/food');

// ---- hashPickMany ----------------------------------------------------------

test('hashPickMany returns the requested number of distinct indices', () => {
  const picks = hashPickMany('daily:2026-07-09', 7, 3);
  assert.strictEqual(picks.length, 3);
  assert.strictEqual(new Set(picks).size, 3);
  picks.forEach((i) => assert.ok(i >= 0 && i < 7));
});

test('hashPickMany is deterministic for the same key', () => {
  assert.deepStrictEqual(hashPickMany('daily:2026-07-09', 7, 3), hashPickMany('daily:2026-07-09', 7, 3));
});

test('hashPickMany varies across dates', () => {
  const keys = Array.from({ length: 30 }, (_, i) => `daily:2026-07-${String(i + 1).padStart(2, '0')}`);
  const distinct = new Set(keys.map((k) => hashPickMany(k, 7, 3).join(',')));
  assert.ok(distinct.size > 1, 'expected different picks on different days');
});

test('hashPickMany clamps when the pool is smaller than count', () => {
  const picks = hashPickMany('weekly:2026-W28', 2, 3);
  assert.strictEqual(picks.length, 2);
});

// ---- Daily Warrior data + rotation ----------------------------------------

test('daily_warrior.json ships 365 complete entries', () => {
  const p = path.resolve(__dirname, '../data/daily_warrior.json');
  const book = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.strictEqual(book.length, 365);
  for (const e of book) {
    assert.ok(e.day >= 1 && e.day <= 365, `day ${e.day} out of range`);
    assert.ok(e.quote.length > 0, `day ${e.day} missing quote`);
    assert.ok(e.homeEdition.length > 0, `day ${e.day} missing home edition`);
    assert.ok(e.originalSession.length > 0, `day ${e.day} missing original session`);
  }
});

test('dailyWarrior.entryForDate is stable within a date and varies across dates', () => {
  // Require lazily: the module pulls in prisma, which is fine to load (no connection
  // is made until a query runs).
  const { entryForDate } = require('../src/services/dailyWarrior');
  const a = entryForDate('2026-07-09');
  const b = entryForDate('2026-07-09');
  assert.strictEqual(a.day, b.day);
  const days = new Set(
    Array.from({ length: 20 }, (_, i) => entryForDate(`2026-08-${String(i + 1).padStart(2, '0')}`).day)
  );
  assert.ok(days.size > 5, `expected varied picks, got ${days.size} distinct over 20 dates`);
});

// ---- localBuilder.parseRequest ---------------------------------------------

test('parseRequest: "quick arm workout" → Arms focus, short single-day session', () => {
  const ctx = parseRequest({ goal: 'quick arm workout' });
  assert.deepStrictEqual(ctx.focus, ['Arms']);
  assert.strictEqual(ctx.perDay, 4);
  assert.strictEqual(ctx.daysPerWeek, 1);
  assert.strictEqual(ctx.guards.length, 0);
});

test('parseRequest: quad focus with knee protection', () => {
  const ctx = parseRequest({ goal: 'quad focused workout with light load on the knees' });
  assert.deepStrictEqual(ctx.focus, ['Legs']);
  assert.deepStrictEqual(ctx.guards, ['knees']);
  assert.ok(ctx.guardedParts.has('Legs'));
});

test('parseRequest: "knee raises" alone does NOT trigger the knee guard', () => {
  const ctx = parseRequest({ goal: 'core workout with hanging knee raises' });
  assert.strictEqual(ctx.guards.length, 0);
});

test('parseRequest: protecting the back removes Back from focus', () => {
  const ctx = parseRequest({ goal: 'leg workout, easy on my bad back' });
  assert.deepStrictEqual(ctx.focus, ['Legs']);
  assert.deepStrictEqual(ctx.guards, ['back']);
});

test('parseRequest: strength/endurance/equipment/level detection', () => {
  const s = parseRequest({ goal: 'heavy strength work' });
  assert.strictEqual(s.goalType, 'strength');
  const e = parseRequest({ goal: 'toning circuit at home' });
  assert.strictEqual(e.goalType, 'endurance');
  assert.deepStrictEqual(e.equipment, ['body only']);
  const b = parseRequest({ goal: 'I am a beginner, never trained before' });
  assert.strictEqual(b.level, 'beginner');
});

test('parseRequest: explicit inputs win over defaults', () => {
  const ctx = parseRequest({ goal: 'build muscle', daysPerWeek: 5, level: 'expert', equipment: ['dumbbell'] });
  assert.strictEqual(ctx.daysPerWeek, 5);
  assert.strictEqual(ctx.level, 'expert');
  assert.deepStrictEqual(ctx.equipment, ['dumbbell']);
});

// ---- health meter -----------------------------------------------------------

test('healthMeter: empty day scores 0 / Starving', () => {
  const h = healthMeter({ calories: 0, protein: 0 }, { calories: 2200, protein: 150 });
  assert.strictEqual(h.score, 0);
  assert.strictEqual(h.label, 'Starving');
});

test('healthMeter: hitting both goals scores 100 / Forged', () => {
  const h = healthMeter({ calories: 2200, protein: 150 }, { calories: 2200, protein: 150 });
  assert.strictEqual(h.score, 100);
  assert.strictEqual(h.label, 'Forged');
});

test('healthMeter: halfway to goals ≈ 50 / Nourished', () => {
  const h = healthMeter({ calories: 1100, protein: 75 }, { calories: 2200, protein: 150 });
  assert.strictEqual(h.score, 50);
  assert.strictEqual(h.label, 'Nourished');
});

test('healthMeter: blowing 20% past the calorie goal drains the meter and labels Overfed', () => {
  const h = healthMeter({ calories: 2640, protein: 150 }, { calories: 2200, protein: 150 });
  assert.strictEqual(h.label, 'Overfed');
  assert.ok(h.score < 90, `expected drained score, got ${h.score}`);
});

test('healthMeter: protein overshoot is capped, never hurts', () => {
  const h = healthMeter({ calories: 2200, protein: 400 }, { calories: 2200, protein: 150 });
  assert.strictEqual(h.score, 100);
});

// ---- starter programs data ---------------------------------------------------

test('starter_programs.json ships 10 programs with valid exercise ids', () => {
  const programs = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/starter_programs.json'), 'utf8'));
  const library = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/exercises_leveled.json'), 'utf8'));
  const ids = new Set(library.map((e) => e.id));
  assert.strictEqual(programs.length, 10);
  for (const p of programs) {
    assert.ok(p.days.length >= 3, `${p.name} has too few days`);
    for (const d of p.days) {
      for (const ex of d.exercises) {
        assert.ok(ids.has(ex.exerciseId), `${p.name}/${d.name}: unknown exercise ${ex.exerciseId}`);
      }
    }
  }
});
