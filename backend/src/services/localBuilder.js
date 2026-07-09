'use strict';

/**
 * Rule-based smart program generator — the no-API-key fallback for the AI builder.
 *
 * Parses a free-text request ("quick arm workout", "quad focused workout with
 * light load on the knees") against the real 873-exercise library and emits a
 * program in the exact same shape as aiBuilder.generateProgram(), so callers
 * and the mobile client can't tell the difference structurally.
 *
 * Understanding, in order:
 *   - body-part focus:  arm/bicep/… → Arms, quad/leg/… → Legs, etc.
 *   - joint guards:     "light on the knees", "bad shoulder" → exclude
 *                       high-load movement patterns for that joint and lean
 *                       toward isolation/machine work for the affected parts
 *   - session length:   quick/short → 4 exercises, long/full → 7, default 5
 *   - training goal:    strength → 5x5 long rest, endurance/tone → 3x15 short
 *                       rest, default hypertrophy 4x8-12
 *   - equipment:        request list or text ("bodyweight only", "dumbbells")
 *   - experience:       beginner sees beginner moves, expert sees everything
 */

const prisma = require('../db/prisma');

const BODY_PART_KEYWORDS = {
  Arms: /\b(arms?|biceps?|triceps?|forearms?|shoulders?|delts?|curls?)\b/i,
  Legs: /\b(legs?|quads?|quadriceps|hamstrings?|glutes?|calv(?:es)?|calf|thighs?|lower body)\b/i,
  Chest: /\b(chest|pecs?|pectorals?|push day|bench)\b/i,
  Back: /\b(back|lats?|traps?|rows?|pull day|pull-?ups?)\b/i,
  Core: /\b(core|abs?|abdominals?|obliques?|six[- ]?pack|stomach)\b/i,
};

// Joint guards: trigger phrases → { exclude: name/category patterns, easeParts }.
// easeParts get isolation/machine preference instead of heavy compounds.
const JOINT_GUARDS = {
  knees: {
    trigger: /\bknees?\b/i,
    exclude: /jump|lunge|squat|pistol|step[- ]?up|box\b|leap|bound|burpee|skater|sprint|plyo/i,
    excludeCategory: /plyometrics/i,
    easeParts: ['Legs'],
  },
  shoulders: {
    trigger: /\bshoulders?\b/i,
    exclude: /overhead|military|press behind|snatch|jerk|handstand|upright row|dips?\b/i,
    excludeCategory: /olympic/i,
    easeParts: ['Arms', 'Chest'],
  },
  back: {
    trigger: /\b(lower )?back\b/i,
    exclude: /deadlift|good morning|bent over|hyperext|clean\b|snatch|jerk/i,
    excludeCategory: /olympic|powerlifting|strongman/i,
    easeParts: ['Back', 'Legs'],
  },
  wrists: {
    trigger: /\bwrists?\b/i,
    exclude: /push-?up|handstand|clean\b|front squat|wrist/i,
    excludeCategory: /olympic/i,
    easeParts: ['Arms'],
  },
};

// A guard phrase must express protection, not focus ("light on the knees" vs "knee raises").
const GUARD_CONTEXT = /\b(light(?:er)?|easy|easier|gentle|no|avoid|spare|protect|bad|sore|hurt|injur\w*|pain\w*|recover\w*|without stress)\b/i;

const GOAL_PRESETS = {
  strength: { sets: 5, reps: '5', restSeconds: 180 },
  endurance: { sets: 3, reps: '15-20', restSeconds: 60 },
  hypertrophy: { sets: 4, reps: '8-12', restSeconds: 90 },
};

const SPLIT_ROTATION = [
  { name: 'Chest & Arms', bodyParts: ['Chest', 'Arms'] },
  { name: 'Back & Core', bodyParts: ['Back', 'Core'] },
  { name: 'Legs', bodyParts: ['Legs'] },
  { name: 'Arms & Core', bodyParts: ['Arms', 'Core'] },
  { name: 'Chest & Back', bodyParts: ['Chest', 'Back'] },
  { name: 'Full Body', bodyParts: ['Legs', 'Chest', 'Back'] },
];

function parseRequest(input) {
  const text = [input.goal, input.notes].filter(Boolean).join('. ');

  const focus = Object.keys(BODY_PART_KEYWORDS).filter((bp) => BODY_PART_KEYWORDS[bp].test(text));

  const guards = [];
  for (const [joint, g] of Object.entries(JOINT_GUARDS)) {
    if (g.trigger.test(text) && GUARD_CONTEXT.test(text)) guards.push(joint);
  }
  // "back" is both a body part and a joint — if the text asks to PROTECT the
  // back, don't also treat it as a focus target.
  const guardedParts = new Set(guards.flatMap((j) => JOINT_GUARDS[j].easeParts));
  const focusFinal = focus.filter((bp) => !(bp === 'Back' && guards.includes('back')));

  let perDay = 5;
  if (/\b(quick|short|fast|express|15 ?min|20 ?min)\b/i.test(text)) perDay = 4;
  else if (/\b(long|full|complete|thorough|60 ?min|90 ?min)\b/i.test(text)) perDay = 7;

  let goalType = 'hypertrophy';
  if (/\b(strength|strong|heavy|powerlifting|1 ?rm|max)\b/i.test(text)) goalType = 'strength';
  else if (/\b(endurance|tone|toning|lean|cardio|conditioning|circuit)\b/i.test(text)) goalType = 'endurance';

  let level = (input.level || '').toLowerCase();
  if (!['beginner', 'intermediate', 'expert'].includes(level)) {
    if (/\b(beginner|new|never|first time|start)\b/i.test(text)) level = 'beginner';
    else if (/\b(advanced|expert|years of|athlete)\b/i.test(text)) level = 'expert';
    else level = 'intermediate';
  }

  let equipment = Array.isArray(input.equipment) && input.equipment.length ? input.equipment : null;
  if (!equipment) {
    if (/\b(body ?weight|no equipment|at home|hotel|travel)\b/i.test(text)) equipment = ['body only'];
    else if (/\bdumbbells? only\b/i.test(text)) equipment = ['dumbbell', 'body only'];
    else if (/\bbands? only\b/i.test(text)) equipment = ['bands', 'body only'];
  }

  const daysPerWeek = input.daysPerWeek || (focusFinal.length ? 1 : 3);

  return { text, focus: focusFinal, guards, guardedParts, perDay, goalType, level, equipment, daysPerWeek };
}

function allowedLevels(level) {
  if (level === 'beginner') return ['beginner'];
  if (level === 'expert') return ['beginner', 'intermediate', 'expert'];
  return ['beginner', 'intermediate'];
}

function passesGuards(ex, guards) {
  for (const j of guards) {
    const g = JOINT_GUARDS[j];
    if (g.exclude.test(ex.name)) return false;
    if (ex.category && g.excludeCategory.test(ex.category)) return false;
  }
  return true;
}

// Score an exercise for a slot. Compounds lead the session for free work; when a
// joint guard covers this body part, isolation/machine work scores higher instead.
function scoreExercise(ex, { goalType, guardedParts }) {
  let s = 0;
  const eased = ex.bodyParts.some((bp) => guardedParts.has(bp));
  if (eased) {
    if (ex.mechanic === 'isolation') s += 3;
    if (ex.equipment === 'machine' || ex.equipment === 'cable') s += 2;
  } else {
    if (ex.mechanic === 'compound') s += 3;
    if (ex.equipment === 'barbell') s += goalType === 'strength' ? 2 : 1;
    if (ex.equipment === 'dumbbell') s += 1;
  }
  if (ex.category === 'strength') s += 2;
  if (ex.category === 'stretching' || ex.category === 'cardio') s -= 4;
  return s + Math.random(); // small jitter so repeat generates vary
}

async function pickExercises(bodyParts, count, ctx) {
  const where = {
    bodyParts: { hasSome: bodyParts },
    level: { in: allowedLevels(ctx.level) },
  };
  if (ctx.equipment) where.equipment = { in: ctx.equipment };
  let pool = await prisma.exercise.findMany({
    select: { id: true, name: true, bodyParts: true, equipment: true, mechanic: true, category: true, level: true },
    where,
  });
  pool = pool.filter((ex) => passesGuards(ex, ctx.guards));
  pool.sort((a, b) => scoreExercise(b, ctx) - scoreExercise(a, ctx));

  // Round-robin across the requested body parts so a "Chest & Arms" day isn't
  // five chest movements; dedupe by id.
  const picked = [];
  const seen = new Set();
  const perPart = Object.fromEntries(bodyParts.map((bp) => [bp, pool.filter((e) => e.bodyParts.includes(bp))]));
  let i = 0;
  while (picked.length < count && i < count * 4) {
    const bp = bodyParts[i % bodyParts.length];
    const next = (perPart[bp] || []).find((e) => !seen.has(e.id));
    if (next) {
      seen.add(next.id);
      picked.push(next);
    }
    i++;
    if (bodyParts.every((p) => (perPart[p] || []).every((e) => seen.has(e.id)))) break;
  }
  return picked;
}

function toProgramDay(dayNumber, name, bodyParts, exercises, preset) {
  const series = ['A', 'B', 'C', 'D'];
  return {
    dayNumber,
    name,
    isRest: false,
    bodyParts,
    exercises: exercises.map((ex, i) => ({
      exerciseId: ex.id,
      series: series[Math.floor(i / 2)] || 'D',
      orderInSeries: (i % 2) + 1,
      sets: preset.sets,
      reps: preset.reps,
      restSeconds: preset.restSeconds,
    })),
  };
}

function titleCase(s) {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));
}

async function generateProgram(input) {
  const ctx = parseRequest(input || {});
  const preset = GOAL_PRESETS[ctx.goalType];

  const days = [];
  if (ctx.focus.length) {
    // Focused request → every training day hits the focus (plus a core finisher).
    for (let d = 1; d <= ctx.daysPerWeek; d++) {
      const main = await pickExercises(ctx.focus, ctx.perDay - 1, ctx);
      const finisher = ctx.focus.includes('Core') ? [] : await pickExercises(['Core'], 1, ctx);
      days.push(
        toProgramDay(d, `${ctx.focus.join(' & ')} Focus`, ctx.focus, [...main, ...finisher], preset)
      );
    }
  } else {
    for (let d = 1; d <= ctx.daysPerWeek; d++) {
      const split = SPLIT_ROTATION[(d - 1) % SPLIT_ROTATION.length];
      const picked = await pickExercises(split.bodyParts, ctx.perDay, ctx);
      days.push(toProgramDay(d, split.name, split.bodyParts, picked, preset));
    }
  }

  const bits = [];
  if (ctx.guards.length) bits.push(`easy on the ${ctx.guards.join(' & ')}`);
  bits.push(`${ctx.goalType} focus`, `${ctx.level} level`);
  if (ctx.equipment) bits.push(`equipment: ${ctx.equipment.join(', ')}`);

  const name = ctx.focus.length
    ? `${ctx.focus.join(' & ')} ${ctx.perDay <= 4 ? 'Quick Strike' : 'Assault'}`
    : titleCase(input.goal || 'Forged Path');

  return {
    program: {
      name,
      description: `Forged from your request (${bits.join(', ')}). Built by the LEVELED armory from the real exercise library.`,
      durationWeeks: ctx.daysPerWeek === 1 ? 1 : 4,
      daysPerWeek: ctx.daysPerWeek,
      days,
    },
    droppedExerciseIds: [],
    generator: 'rules',
  };
}

module.exports = { generateProgram, parseRequest };
