'use strict';

/**
 * AI workout program builder + validator (Claude API).
 *
 * Two capabilities (master doc Part 16, Screen 7):
 *  - generateProgram(goals): produce a full structured Program from goals/days/
 *    equipment/level. Every exercise must reference a real id from the 873-row
 *    library; hallucinated ids are rejected/repaired by post-validation.
 *  - validateWorkout(program): critique a user-built workout for sound structure
 *    (volume, push/pull & body-part balance, rest, progression).
 *
 * Model is env-driven (ANTHROPIC_MODEL) so no specific model string is pinned in
 * source; set it to the latest Claude model. Requires ANTHROPIC_API_KEY.
 */

const Anthropic = require('@anthropic-ai/sdk');
const prisma = require('../db/prisma');

const MODEL = process.env.ANTHROPIC_MODEL;
let client = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw Object.assign(new Error('ANTHROPIC_API_KEY is not set'), { status: 503 });
  }
  if (!MODEL) {
    throw Object.assign(new Error('ANTHROPIC_MODEL is not set'), { status: 503 });
  }
  if (!client) client = new Anthropic();
  return client;
}

// Compact exercise catalog (id, name, bodyParts, equipment, mechanic) for the prompt.
async function exerciseCatalog() {
  const rows = await prisma.exercise.findMany({
    select: { id: true, name: true, bodyParts: true, equipment: true, mechanic: true, level: true },
  });
  return rows;
}

const PROGRAM_TOOL = {
  name: 'emit_program',
  description: 'Return the structured workout program.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      durationWeeks: { type: 'integer' },
      daysPerWeek: { type: 'integer' },
      days: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            dayNumber: { type: 'integer' },
            name: { type: 'string' },
            isRest: { type: 'boolean' },
            bodyParts: { type: 'array', items: { type: 'string' } },
            exercises: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  exerciseId: { type: 'string' },
                  series: { type: 'string' },
                  orderInSeries: { type: 'integer' },
                  sets: { type: 'integer' },
                  reps: { type: 'string' },
                  restSeconds: { type: 'integer' },
                  rpe: { type: 'number' },
                  supersetGroup: { type: 'string' },
                },
                required: ['exerciseId', 'series', 'orderInSeries', 'sets', 'reps', 'restSeconds'],
              },
            },
          },
          required: ['dayNumber', 'name', 'isRest', 'bodyParts', 'exercises'],
        },
      },
    },
    required: ['name', 'description', 'durationWeeks', 'daysPerWeek', 'days'],
  },
};

function programSystemPrompt(catalog) {
  // Catalog is large; keep it as a stable prefix for caching.
  const lines = catalog.map((e) => `${e.id}\t${e.name}\t${e.bodyParts.join('/')}\t${e.equipment || '-'}\t${e.mechanic || '-'}`);
  return [
    'You are a strength & conditioning coach building structured workout programs for the LEVELED RPG.',
    'Rules:',
    '- Use ONLY exercises from the catalog below. The exerciseId MUST be an exact id from the first column.',
    '- Group exercises into series A, B, C... Order within a series via orderInSeries.',
    '- Set realistic sets (3-5), rep ranges ("5", "8-12"), and restSeconds (60-180; compounds longer).',
    '- Mark supersets by giving two exercises the same supersetGroup label within a series.',
    '- Balance push/pull and body parts across the week; include rest days (isRest=true, empty exercises).',
    '- Honor the requested daysPerWeek and equipment constraints.',
    '',
    'CATALOG (id<TAB>name<TAB>bodyParts<TAB>equipment<TAB>mechanic):',
    ...lines,
  ].join('\n');
}

// Validate/repair: drop any exercise whose id is not in the catalog set.
function sanitizeProgram(program, validIds) {
  const dropped = [];
  for (const day of program.days || []) {
    day.exercises = (day.exercises || []).filter((ex) => {
      const ok = validIds.has(ex.exerciseId);
      if (!ok) dropped.push(ex.exerciseId);
      return ok;
    });
  }
  return { program, dropped };
}

async function generateProgram(input) {
  const catalog = await exerciseCatalog();
  const validIds = new Set(catalog.map((e) => e.id));
  const sys = programSystemPrompt(catalog);
  const userMsg = [
    `Goal: ${input.goal || 'general strength'}.`,
    `Days per week: ${input.daysPerWeek || 4}.`,
    `Experience: ${input.level || 'intermediate'}.`,
    `Equipment available: ${(input.equipment && input.equipment.join(', ')) || 'full gym'}.`,
    input.notes ? `Notes: ${input.notes}` : '',
    'Call emit_program with the full structured program.',
  ].filter(Boolean).join('\n');

  const resp = await getClient().messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: [{ type: 'text', text: sys, cache_control: { type: 'ephemeral' } }],
    tools: [PROGRAM_TOOL],
    tool_choice: { type: 'tool', name: 'emit_program' },
    messages: [{ role: 'user', content: userMsg }],
  });

  const toolUse = resp.content.find((b) => b.type === 'tool_use');
  if (!toolUse) throw new Error('Model did not return a program');
  const { program, dropped } = sanitizeProgram(toolUse.input, validIds);
  return { program, droppedExerciseIds: dropped };
}

async function validateWorkout(workout) {
  const catalog = await exerciseCatalog();
  const byId = Object.fromEntries(catalog.map((e) => [e.id, e]));
  // Resolve ids to names/bodyparts so the model critiques the real movements.
  const resolved = (workout.exercises || []).map((ex) => ({
    ...ex,
    name: byId[ex.exerciseId]?.name || ex.exerciseId,
    bodyParts: byId[ex.exerciseId]?.bodyParts || [],
    mechanic: byId[ex.exerciseId]?.mechanic,
  }));
  const sys = [
    'You are a strength coach reviewing a single workout for sound structure.',
    'Assess: total volume, push/pull balance, body-part balance, rest adequacy, exercise order,',
    'and progression. Be concrete and concise. Return findings and specific fixes.',
  ].join(' ');
  const resp = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: sys,
    messages: [{ role: 'user', content: `Workout JSON:\n${JSON.stringify(resolved, null, 2)}` }],
  });
  const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  return { critique: text };
}

module.exports = { generateProgram, validateWorkout };
