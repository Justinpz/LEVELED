'use strict';

const test = require('node:test');
const assert = require('node:assert');

process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'test-token-123';
const { parseFoodText, verifySecret, summaryText } = require('../src/services/telegram');

test('parseFoodText: calories only', () => {
  assert.deepStrictEqual(parseFoodText('chicken and rice 650'), {
    name: 'chicken and rice', calories: 650, protein: 0, carbs: 0, fat: 0,
  });
});

test('parseFoodText: full macros in any order', () => {
  assert.deepStrictEqual(parseFoodText('protein shake 220 30p 12c 4f'), {
    name: 'protein shake', calories: 220, protein: 30, carbs: 12, fat: 4,
  });
  assert.deepStrictEqual(parseFoodText('burrito 40p 750 20f'), {
    name: 'burrito', calories: 750, protein: 40, carbs: 0, fat: 20,
  });
});

test('parseFoodText: cal/kcal suffixes and separate unit words', () => {
  assert.strictEqual(parseFoodText('oats 320cal 8p').calories, 320);
  assert.strictEqual(parseFoodText('oats 320kcal').calories, 320);
  assert.strictEqual(parseFoodText('oats 320 cal 8p').calories, 320);
  assert.strictEqual(parseFoodText('oats 320 cal 8p').name, 'oats');
});

test('parseFoodText: no numbers → null (AI fallback territory)', () => {
  assert.strictEqual(parseFoodText('two eggs and toast'), null);
  assert.strictEqual(parseFoodText('/today'), null);
});

test('parseFoodText: name defaults when only numbers given', () => {
  assert.strictEqual(parseFoodText('600').name, 'food');
});

test('verifySecret: accepts derived secret, rejects others', () => {
  const crypto = require('crypto');
  const expected = crypto
    .createHmac('sha256', process.env.TELEGRAM_BOT_TOKEN)
    .update('leveled-telegram-webhook')
    .digest('hex')
    .slice(0, 48);
  assert.strictEqual(verifySecret(expected), true);
  assert.strictEqual(verifySecret('wrong'), false);
  assert.strictEqual(verifySecret(undefined), false);
});

test('summaryText renders totals, goals and health', () => {
  const text = summaryText({
    totals: { calories: 1840, protein: 132, carbs: 180, fat: 60 },
    goals: { calories: 2400, protein: 180, carbs: 250, fat: 80 },
    health: { score: 82, label: 'Strong' },
  });
  assert.ok(text.includes('1840/2400 kcal'));
  assert.ok(text.includes('132/180g protein'));
  assert.ok(text.includes('82/100 — Strong'));
});
