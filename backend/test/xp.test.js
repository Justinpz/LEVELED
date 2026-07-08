'use strict';

// Unit tests for the XP engine — the rules everything else depends on.
// Run: npm test  (node --test, no dependencies)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const xp = require('../src/lib/xp');

const deadlift = {
  primaryBodyParts: ['Back'],
  secondaryBodyParts: ['Arms', 'Legs'],
  mechanic: 'compound',
};

test('70/30 split: primary gets 70, secondaries share 30 (no class)', () => {
  const award = xp.pointsForExercise(deadlift, {});
  assert.deepEqual(award, { Back: 70, Arms: 15, Legs: 15 });
});

test('no secondary parts -> all 100 to primary', () => {
  const award = xp.pointsForExercise({ primaryBodyParts: ['Chest'], secondaryBodyParts: [] }, {});
  assert.deepEqual(award, { Chest: 100 });
});

test('secondary listed as primary is not double-counted', () => {
  const award = xp.pointsForExercise(
    { primaryBodyParts: ['Back'], secondaryBodyParts: ['Back', 'Legs'] },
    {}
  );
  assert.deepEqual(award, { Back: 70, Legs: 30 });
});

test('warrior bonuses: +25% compound, +10% heavy, +10% Legs/Back/Chest', () => {
  const award = xp.pointsForExercise(deadlift, { charClass: 'warrior', isHeavy: true });
  // Back: 70 * (1 + .25 + .10 + .10) = 101.5 -> 102
  // Arms: 15 * (1 + .25 + .10)       = 20.25 -> 20 (no body-part bonus)
  // Legs: 15 * (1 + .25 + .10 + .10) = 21.75 -> 22
  assert.deepEqual(award, { Back: 102, Arms: 20, Legs: 22 });
});

test('non-warrior gets no class bonuses', () => {
  const award = xp.pointsForExercise(deadlift, { charClass: 'mage', isHeavy: true });
  assert.deepEqual(award, { Back: 70, Arms: 15, Legs: 15 });
});

test('exercise with no mapped body parts awards nothing', () => {
  assert.deepEqual(xp.pointsForExercise({}, { charClass: 'warrior' }), {});
});

test('curved level thresholds', () => {
  assert.equal(xp.xpForLevel(1), 0);
  assert.equal(xp.xpForLevel(2), 30000);
  assert.equal(xp.xpForLevel(25), 24 * 30000);
  assert.equal(xp.xpForLevel(26), 24 * 30000 + 45000);
  assert.equal(xp.xpForLevel(100), 5595000);
});

test('levelForXp boundaries and cap', () => {
  assert.equal(xp.levelForXp(0), 1);
  assert.equal(xp.levelForXp(29999), 1);
  assert.equal(xp.levelForXp(30000), 2);
  assert.equal(xp.levelForXp(5595000), 100);
  assert.equal(xp.levelForXp(99999999), 100); // clamped at max
});

test('applyXp reports level-ups and can jump multiple levels', () => {
  const single = xp.applyXp(29999, 1);
  assert.equal(single.leveledUp, true);
  assert.equal(single.newLevel, 2);
  assert.equal(single.levelsGained, 1);

  const multi = xp.applyXp(0, 90000); // exactly 3 levels in the first band
  assert.equal(multi.newLevel, 4);
  assert.equal(multi.levelsGained, 3);

  const none = xp.applyXp(1000, 5);
  assert.equal(none.leveledUp, false);
});

test('band labels', () => {
  assert.equal(xp.levelBandLabel(1), 'Awakening');
  assert.equal(xp.levelBandLabel(26), 'Ascending');
  assert.equal(xp.levelBandLabel(51), 'Forged');
  assert.equal(xp.levelBandLabel(76), 'Mythic');
});
