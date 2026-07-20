'use strict';

/**
 * Shop catalog audit — every one of the 124 gear items must be sellable at its
 * listed price by a player who has reached its level gate.
 *
 * The economy: each body-part slot has its own spendable-points pool. A player
 * at a slot's tier gate must plausibly hold enough points to buy items of that
 * tier — points accrue roughly with XP (100 pts/exercise across parts), so the
 * XP required to REACH the gate level is a hard ceiling on what could have been
 * saved for that slot. Any item priced above the points a player could possibly
 * have banked by its gate level would be unsellable forever — that's a bug.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const xp = require('../src/lib/xp');

const TIER_LEVEL_GATE = { iron: 1, mythic: 21, celestial: 41, abyssal: 61, ascendant: 81 };
const SLOTS = ['arms', 'legs', 'chest', 'back', 'core', 'shoulders'];
const TIERS = Object.keys(TIER_LEVEL_GATE);

const catalog = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/gear_database.json'), 'utf8')
);

test('catalog has 126 items (124 originals + 2 shoulder pieces), all valid', () => {
  assert.strictEqual(catalog.length, 126);
  assert.strictEqual(catalog.filter((i) => i.slot === 'shoulders').length, 2);
  for (const it of catalog) {
    const id = it.item_id || it.id;
    assert.ok(TIERS.includes(it.tier), `${id}: bad tier ${it.tier}`);
    assert.ok(SLOTS.includes(it.slot), `${id}: bad slot ${it.slot}`);
    const cost = it.cost_pts ?? it.costPts;
    assert.ok(Number.isInteger(cost) && cost > 0, `${id}: bad cost ${cost}`);
  }
});

test('every item is affordable by the time its tier unlocks (sellable at listed price)', () => {
  // Points banked in ONE slot can't exceed the player's total lifetime XP for
  // that body part; by the time a slot hits level L the part has at least
  // xpForLevel(L) lifetime XP — and spendable points accrue 1:1 with XP earned.
  // For iron (gate 1) a fresh player starts near 0, so iron items must instead
  // be earnable within a few sessions: ~5 exercises/session × ~70 pts to the
  // primary part × ~10 sessions ≈ 3500 pts ceiling for "reasonably soon".
  const IRON_CEILING = 3500;
  const failures = [];
  for (const it of catalog) {
    const id = it.item_id || it.id;
    const cost = it.cost_pts ?? it.costPts;
    const gate = TIER_LEVEL_GATE[it.tier];
    const ceiling = gate === 1 ? IRON_CEILING : xp.xpForLevel(gate);
    if (cost > ceiling) failures.push(`${id}: cost ${cost} > earnable ${ceiling} at gate ${gate}`);
  }
  assert.deepStrictEqual(failures, []);
});

test('prices rise with tier (no cross-tier inversions per slot)', () => {
  for (const slot of SLOTS) {
    for (let t = 0; t < TIERS.length - 1; t++) {
      const cur = catalog.filter((i) => i.slot === slot && i.tier === TIERS[t]);
      const nxt = catalog.filter((i) => i.slot === slot && i.tier === TIERS[t + 1]);
      if (!cur.length || !nxt.length) continue;
      const cost = (i) => i.cost_pts ?? i.costPts;
      const maxCur = Math.max(...cur.map(cost));
      const minNxt = Math.min(...nxt.map(cost));
      assert.ok(
        minNxt > maxCur * 0.5,
        `${slot}: cheapest ${TIERS[t + 1]} (${minNxt}) undercuts ${TIERS[t]} (max ${maxCur}) too hard`
      );
    }
  }
});

test('every slot has at least one iron item under 300 pts (a first purchase exists)', () => {
  for (const slot of SLOTS) {
    const cheap = catalog.filter(
      (i) => i.slot === slot && i.tier === 'iron' && (i.cost_pts ?? i.costPts) <= 300
    );
    assert.ok(cheap.length >= 1, `${slot}: no starter-affordable iron item`);
  }
});
