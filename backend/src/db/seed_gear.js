'use strict';

/**
 * Seed the `gear_items` table from the (Warrior-filtered) gear_database.json.
 * Idempotent upsert by item_id. Reads from the sibling LEVELED_Images repo if
 * present, else from a local copy at data/gear_database.json.
 *
 * Tier -> body-part level gate (master doc Part 5):
 *   iron 1 | mythic 21 | celestial 41 | abyssal 61 | ascendant 81
 *
 * Usage:  node src/db/seed_gear.js   (or: GEAR_DB=/path/to/gear_database.json node ...)
 */

const fs = require('fs');
const path = require('path');
const prisma = require('./prisma');

const TIER_GATE = { iron: 1, mythic: 21, celestial: 41, abyssal: 61, ascendant: 81 };

function resolveDbPath() {
  if (process.env.GEAR_DB) return process.env.GEAR_DB;
  const candidates = [
    path.resolve(__dirname, '../../../data/gear_database.json'),
    path.resolve(__dirname, '../../../../LEVELED_Images/gear_database.json'),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

async function main() {
  const dbPath = resolveDbPath();
  if (!dbPath) throw new Error('gear_database.json not found; set GEAR_DB=/path/to/gear_database.json');
  const items = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  console.log(`[seed_gear] Read ${items.length} items from ${dbPath}`);

  let i = 0;
  for (const it of items) {
    const data = {
      id: it.item_id,
      name: it.name,
      tier: it.tier,
      slot: it.slot,
      classCompatibility: it.class_compatibility,
      costPts: it.cost_pts,
      levelGate: TIER_GATE[it.tier] ?? 1,
      description: it.description || '',
      flavorText: it.flavor_text || '',
      visualNotes: it.visual_notes ?? null,
      glowColor: it.glow_color ?? null,
      particles: it.particles ?? null,
      imageAssetPath: it.image_asset_path ?? null,
      imageSourceSheet: it.image_source_sheet ?? null,
    };
    await prisma.gearItem.upsert({ where: { id: data.id }, create: data, update: data });
    if (++i % 50 === 0) console.log(`[seed_gear] ${i}/${items.length}...`);
  }
  const count = await prisma.gearItem.count();
  console.log(`Seeded ${count} gear items`);
}

main()
  .catch((err) => {
    console.error('[seed_gear] Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
