'use strict';

/**
 * One-off: AI-generate the starter "suggest from" program library (master doc
 * Part 16 / Part 23). Writes data/starter_programs.json for owner review BEFORE
 * anything is seeded. Re-run freely; it overwrites the review file only.
 *
 * Requires ANTHROPIC_API_KEY + ANTHROPIC_MODEL and a reachable DATABASE_URL
 * (the builder reads the 873-row exercise library to constrain exerciseIds).
 *
 * Usage:  npm run ai:starters
 */

const fs = require('fs');
const path = require('path');
const prisma = require('../db/prisma');
const aiBuilder = require('../services/aiBuilder');

// 11 starter briefs spanning experience levels, splits, and equipment.
const BRIEFS = [
  { goal: 'Full-body strength foundation for beginners', daysPerWeek: 3, level: 'beginner', equipment: ['full gym'] },
  { goal: 'Upper/Lower hypertrophy', daysPerWeek: 4, level: 'intermediate', equipment: ['full gym'] },
  { goal: 'Push/Pull/Legs for size', daysPerWeek: 6, level: 'intermediate', equipment: ['full gym'] },
  { goal: 'Powerbuilding — strength + size', daysPerWeek: 4, level: 'advanced', equipment: ['barbell', 'dumbbell', 'machine'] },
  { goal: 'Home dumbbell-only physique program', daysPerWeek: 4, level: 'intermediate', equipment: ['dumbbell', 'body only'] },
  { goal: 'Bodyweight / calisthenics progression', daysPerWeek: 4, level: 'beginner', equipment: ['body only'] },
  { goal: 'Back & arms focus (the Warrior path)', daysPerWeek: 4, level: 'intermediate', equipment: ['full gym'] },
  { goal: 'Leg specialization block', daysPerWeek: 4, level: 'advanced', equipment: ['full gym'] },
  { goal: 'Chest & shoulders emphasis', daysPerWeek: 4, level: 'intermediate', equipment: ['full gym'] },
  { goal: 'Core & conditioning circuit', daysPerWeek: 3, level: 'beginner', equipment: ['body only', 'kettlebell'] },
  { goal: 'Time-efficient 30-minute full-body', daysPerWeek: 3, level: 'intermediate', equipment: ['dumbbell', 'machine'] },
];

async function main() {
  const out = [];
  for (const [i, brief] of BRIEFS.entries()) {
    process.stdout.write(`[starters] ${i + 1}/${BRIEFS.length} "${brief.goal}"... `);
    try {
      const { program, droppedExerciseIds } = await aiBuilder.generateProgram(brief);
      program.isStarter = true;
      program.designedBy = 'LEVELED AI Coach';
      out.push(program);
      console.log(`ok (${program.days?.length || 0} days, ${droppedExerciseIds.length} dropped)`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }
  const dst = path.resolve(__dirname, '../../../data/starter_programs.json');
  fs.writeFileSync(dst, JSON.stringify(out, null, 2));
  console.log(`Wrote ${out.length} starter programs to ${dst} (review before seeding)`);
}

main()
  .catch((err) => {
    console.error('[starters] Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
