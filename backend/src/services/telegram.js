'use strict';

/**
 * Telegram food-tracking bot — a second front door into the food diary.
 *
 * Zero-setup beyond env: when TELEGRAM_BOT_TOKEN is set, boot registers this
 * server's webhook with Telegram (with a secret header derived from the
 * token), so messages to the bot land on POST /webhooks/telegram.
 *
 * Conversation surface:
 *   /start        bind this chat to the player (first chat wins; others rejected)
 *   /today        current totals + health meter
 *   /help         message formats
 *   "<food> 750"                 log 750 kcal
 *   "<food> 750 30p 80c 20f"    log with macros (any order, cal/kcal optional)
 *   free text (no numbers)       AI macro estimate when ANTHROPIC_API_KEY is
 *                                set; otherwise replies with format help
 *
 * The bound chat id lives in User.settings.telegramChatId (JSONB) — clear it
 * there to re-pair a different Telegram account.
 */

const crypto = require('crypto');
const prisma = require('../db/prisma');
const { todayPayload } = require('../routes/food');

const API = 'https://api.telegram.org';

function token() {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

// Secret Telegram echoes back in X-Telegram-Bot-Api-Secret-Token on every
// webhook call — derived, so there's no second secret to manage.
function webhookSecret() {
  const t = token();
  if (!t) return null;
  return crypto.createHmac('sha256', t).update('leveled-telegram-webhook').digest('hex').slice(0, 48);
}

function verifySecret(headerValue) {
  const expected = webhookSecret();
  if (!expected || !headerValue) return false;
  const a = Buffer.from(String(headerValue));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function tg(method, body) {
  const t = token();
  if (!t) return null;
  const res = await fetch(`${API}/bot${t}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!data || !data.ok) {
    console.error(`[telegram] ${method} failed:`, data && data.description);
  }
  return data;
}

const sendMessage = (chatId, text) => tg('sendMessage', { chat_id: chatId, text });

// Boot-time self-registration. PUBLIC_URL overrides for other hosts.
async function registerWebhook() {
  if (!token()) return; // bot not configured — feature stays dormant
  const base = process.env.PUBLIC_URL || 'https://leveled.onrender.com';
  try {
    await tg('setWebhook', {
      url: `${base}/webhooks/telegram`,
      secret_token: webhookSecret(),
      allowed_updates: ['message'],
      drop_pending_updates: false,
    });
    await tg('setMyCommands', {
      commands: [
        { command: 'today', description: "Today's totals + health meter" },
        { command: 'help', description: 'How to log food' },
      ],
    });
    console.log('[telegram] webhook registered at', `${base}/webhooks/telegram`);
  } catch (err) {
    console.error('[telegram] webhook registration failed (bot disabled):', err.message);
  }
}

/**
 * Parse a structured food message. Returns { name, calories, protein, carbs,
 * fat } or null when the text carries no calorie number (AI fallback territory).
 * Trailing number tokens are read as macros: bare number / Ncal / Nkcal =
 * calories, Np = protein, Nc = carbs, Nf = fat — any order.
 */
function parseFoodText(text) {
  const tokens = String(text).trim().split(/\s+/);
  const nameParts = [];
  let calories = null;
  const macros = {};
  for (const tok of tokens) {
    const m = /^(\d{1,5})(p|c|f|g|cal|kcal)?$/i.exec(tok.replace(/,/g, ''));
    if (m) {
      const val = parseInt(m[1], 10);
      const unit = (m[2] || '').toLowerCase();
      if (unit === 'p') macros.protein = val;
      else if (unit === 'c') macros.carbs = val;
      else if (unit === 'f') macros.fat = val;
      else if (calories === null) calories = val; // bare / cal / kcal / g→ignore unit, first number wins
      continue;
    }
    if (/^(cal|kcal|calories)$/i.test(tok)) continue; // "750 cal" split across tokens
    nameParts.push(tok);
  }
  if (calories === null) return null;
  return {
    name: nameParts.join(' ') || 'food',
    calories,
    protein: macros.protein || 0,
    carbs: macros.carbs || 0,
    fat: macros.fat || 0,
  };
}

// AI macro estimation for free-text meals ("2 eggs and toast"). Only active
// when ANTHROPIC_API_KEY is configured; errors degrade to the format help.
async function estimateWithAI(text) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content:
            `Estimate nutrition for this meal: "${String(text).slice(0, 300)}". ` +
            'Reply with ONLY a JSON object: {"name": short label, "calories": int, ' +
            '"protein": grams int, "carbs": grams int, "fat": grams int}. Typical serving sizes.',
        }],
      }),
    });
    const data = await res.json();
    const raw = data && data.content && data.content[0] && data.content[0].text;
    const json = JSON.parse((raw.match(/\{[\s\S]*\}/) || [])[0]);
    if (!Number.isFinite(json.calories)) return null;
    return {
      name: String(json.name || text).slice(0, 120),
      calories: Math.max(0, Math.round(json.calories)),
      protein: Math.max(0, Math.round(json.protein || 0)),
      carbs: Math.max(0, Math.round(json.carbs || 0)),
      fat: Math.max(0, Math.round(json.fat || 0)),
      estimated: true,
    };
  } catch (err) {
    console.error('[telegram] AI estimate failed:', err.message);
    return null;
  }
}

const HELP =
  'Log food by texting me:\n' +
  '  chicken and rice 650\n' +
  '  protein shake 220 30p 12c 4f\n' +
  '(first number = calories; p/c/f = protein/carbs/fat grams, any order)\n\n' +
  '/today — totals + health meter\n\n' +
  'Plain descriptions like "2 eggs and toast" work too when AI estimation is enabled on the server.';

function summaryText(payload) {
  const { totals, goals, health } = payload;
  const line = (label, have, goal, unit) => `${label} ${have}${goal ? `/${goal}` : ''}${unit}`;
  return (
    `${line('🔥', totals.calories, goals.calories, ' kcal')}\n` +
    `${line('💪', totals.protein, goals.protein, 'g protein')} · ` +
    `${line('🌾', totals.carbs, goals.carbs, 'g carbs')} · ` +
    `${line('🧈', totals.fat, goals.fat, 'g fat')}\n` +
    `❤️ Health: ${health.score}/100 — ${health.label}`
  );
}

async function actingUser() {
  return prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
}

// Main webhook handler. Always resolves (route replies 200 regardless) — a
// bad message must never make Telegram retry-storm the server.
async function handleUpdate(update) {
  try {
    const msg = update && (update.message || update.edited_message);
    if (!msg || !msg.chat) return;
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    if (!text) {
      await sendMessage(chatId, 'I only understand text for now — describe the meal or send "/help".');
      return;
    }

    const user = await actingUser();
    if (!user) return;

    const settings = user.settings || {};
    const bound = settings.telegramChatId;

    if (!bound) {
      // First chat to speak claims the player (single-warrior game).
      await prisma.user.update({
        where: { id: user.id },
        data: { settings: { ...settings, telegramChatId: chatId } },
      });
      await sendMessage(
        chatId,
        '⚔ Chat bound to your LEVELED warrior.\n\n' + HELP
      );
      if (/^\/start/.test(text)) return; // pure /start: welcome is enough
    } else if (String(bound) !== String(chatId)) {
      await sendMessage(chatId, 'This bot is already bound to another warrior.');
      return;
    }

    if (/^\/start/.test(text) || /^\/help/.test(text)) {
      await sendMessage(chatId, HELP);
      return;
    }
    if (/^\/today/.test(text)) {
      await sendMessage(chatId, `📜 Today:\n${summaryText(await todayPayload(user))}`);
      return;
    }

    let item = parseFoodText(text);
    if (!item) item = await estimateWithAI(text);
    if (!item) {
      await sendMessage(chatId, `Couldn't find a calorie number in that.\n\n${HELP}`);
      return;
    }
    if (item.calories > 20000) {
      await sendMessage(chatId, 'That calorie count seems off (max 20000).');
      return;
    }

    await prisma.foodLog.create({
      data: {
        userId: user.id,
        name: item.name.slice(0, 120),
        calories: item.calories,
        protein: Math.min(1000, item.protein),
        carbs: Math.min(2000, item.carbs),
        fat: Math.min(1000, item.fat),
        date: new Date(new Date().toISOString().slice(0, 10)),
      },
    });
    const payload = await todayPayload(user);
    await sendMessage(
      chatId,
      `✅ Logged: ${item.name} — ${item.calories} kcal` +
        `${item.protein ? ` · ${item.protein}p` : ''}${item.carbs ? ` · ${item.carbs}c` : ''}${item.fat ? ` · ${item.fat}f` : ''}` +
        `${item.estimated ? ' (AI estimate)' : ''}\n\n${summaryText(payload)}`
    );
  } catch (err) {
    console.error('[telegram] update handling failed:', err.message);
  }
}

module.exports = { registerWebhook, handleUpdate, verifySecret, parseFoodText, summaryText };
