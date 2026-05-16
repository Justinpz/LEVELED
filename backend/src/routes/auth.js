'use strict';

/**
 * WHOOP OAuth 2.0 flow.
 *
 *   GET /auth/whoop/start     → generate state, redirect to WHOOP authorize URL
 *   GET /auth/whoop/callback  → verify state, exchange code, encrypt tokens, persist
 *
 * Phase 1 caveat: there is no real user auth yet. We upsert a placeholder
 * `users` row keyed by the WHOOP-reported email (falls back to a synthetic
 * address). Phase 2 will replace this with a real sign-in.
 */

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');

const prisma = require('../db/prisma');
const { encrypt } = require('../lib/crypto');
const whoop = require('../lib/whoop');

const router = express.Router();

// Per-spec: rate-limit all /auth/* endpoints to deter abuse.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth requests, slow down.' },
});
router.use(authLimiter);

router.get('/whoop/start', (req, res, next) => {
  try {
    const redirectUri = process.env.WHOOP_REDIRECT_URI;
    if (!redirectUri) {
      return res.status(500).send('Server misconfigured: WHOOP_REDIRECT_URI not set');
    }

    const state = crypto.randomBytes(16).toString('hex');
    req.session.whoopOauthState = state;

    const url = whoop.buildAuthorizeUrl({ state, redirectUri });
    res.redirect(url);
  } catch (err) {
    next(err);
  }
});

router.get('/whoop/callback', async (req, res, next) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      // WHOOP can redirect back with error=access_denied etc.
      return res
        .status(400)
        .send(`WHOOP returned an error: ${String(error)} ${error_description ? '— ' + String(error_description) : ''}`);
    }
    if (!code || !state) {
      return res.status(400).send('Missing code or state parameter');
    }

    const expected = req.session.whoopOauthState;
    if (!expected || expected !== state) {
      return res.status(400).send('Invalid OAuth state — possible CSRF attempt');
    }
    // One-time use: clear state after verification
    delete req.session.whoopOauthState;

    const redirectUri = process.env.WHOOP_REDIRECT_URI;
    const tokens = await whoop.exchangeCodeForTokens({ code: String(code), redirectUri });

    // Fetch profile so we can identify the WHOOP user. Email is best-effort —
    // some WHOOP accounts don't expose it; we fall back to a synthetic one.
    let profile;
    try {
      profile = await whoop.fetchProfile({ accessToken: tokens.access_token });
    } catch (e) {
      console.error('[auth/whoop/callback] profile fetch failed:', e.message);
      profile = {};
    }

    const whoopUserId = profile.user_id ?? 0;
    const email =
      profile.email && typeof profile.email === 'string'
        ? profile.email
        : `whoop-user-${whoopUserId}@placeholder.leveled.local`;

    // Encrypt each token with its OWN IV (never reuse GCM IVs under same key).
    const accessEnc = encrypt(tokens.access_token);
    const refreshEnc = encrypt(tokens.refresh_token);

    const expiresAt = new Date(Date.now() + Number(tokens.expires_in) * 1000);

    // Placeholder user — Phase 2 replaces this with real auth.
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    await prisma.whoopConnection.upsert({
      where: { userId: user.id },
      update: {
        accessToken: accessEnc.ciphertext,
        accessTokenIv: accessEnc.iv,
        refreshToken: refreshEnc.ciphertext,
        refreshTokenIv: refreshEnc.iv,
        expiresAt,
        scopes: tokens.scope || whoop.REQUIRED_SCOPES.join(' '),
        whoopUserId,
        connectedAt: new Date(),
      },
      create: {
        userId: user.id,
        accessToken: accessEnc.ciphertext,
        accessTokenIv: accessEnc.iv,
        refreshToken: refreshEnc.ciphertext,
        refreshTokenIv: refreshEnc.iv,
        expiresAt,
        scopes: tokens.scope || whoop.REQUIRED_SCOPES.join(' '),
        whoopUserId,
      },
    });

    console.log(`[auth/whoop/callback] connected user=${user.id} whoop=${whoopUserId}`);

    res.set('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>LEVELED — WHOOP connected</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 20px; text-align: center; color: #1a1a1a; }
    h1 { color: #0a7c4a; margin-bottom: 8px; }
    p { color: #555; line-height: 1.6; }
    .check { font-size: 64px; line-height: 1; }
  </style>
</head>
<body>
  <div class="check">✓</div>
  <h1>WHOOP connected</h1>
  <p>You can close this tab.</p>
</body>
</html>`);
  } catch (err) {
    // Sanitize: don't leak token contents into logs/error response.
    const safeMsg = err.response?.status
      ? `WHOOP API error ${err.response.status}`
      : err.message;
    console.error('[auth/whoop/callback]', safeMsg);
    next(new Error(safeMsg));
  }
});

module.exports = router;
