'use strict';

/**
 * LEVELED backend — Express 5 entry point.
 *
 * Boot order matters:
 *   1. helmet (security headers) before anything
 *   2. /webhooks mounted BEFORE express.json so raw body is preserved
 *      for HMAC signature verification
 *   3. express.json() for the rest of the routes
 *   4. express-session (in-memory) for OAuth state correlation
 *   5. /health, /auth mounted last
 *   6. centralized error handler that never leaks token contents
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');

const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const webhookRoutes = require('./routes/webhooks');
const gameRoutes = require('./routes/game');
const programRoutes = require('./routes/programs');
const challengeRoutes = require('./routes/challenges');
const foodRoutes = require('./routes/food');
const settingsRoutes = require('./routes/settings');
const adminRoutes = require('./routes/admin');

const app = express();

// Railway and most PaaS sit behind a reverse proxy. Trust the first proxy hop
// so req.ip and secure-cookie detection work correctly.
app.set('trust proxy', 1);

// Disable the default x-powered-by header (helmet does this too, redundant but explicit).
app.disable('x-powered-by');

// Dev request logger — quick one-liner per request so we can see the OAuth flow.
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(
        `[req] ${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - start}ms)`
      );
    });
    next();
  });
}

// 1) Security headers
app.use(helmet());

// CORS — native mobile fetch ignores CORS, but Expo web / browser clients need it.
// Lock down with CORS_ORIGIN in production once the client origin is known.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// 2) Webhooks BEFORE json — raw body required for HMAC verification.
app.use('/webhooks', webhookRoutes);

// 3) JSON body parser for everything else
app.use(express.json({ limit: '1mb' }));

// 4) Sessions (in-memory; Phase 2 swaps for Postgres-backed)
const isHttpsLocal = !!(process.env.TLS_CERT_PATH && process.env.TLS_KEY_PATH);
const isProd = process.env.NODE_ENV === 'production';

if (!process.env.SESSION_SECRET) {
  console.warn(
    '[server] WARNING: SESSION_SECRET is not set — generate one with `npm run keys:generate`'
  );
}

app.use(
  session({
    name: 'leveled.sid',
    secret: process.env.SESSION_SECRET || 'dev-do-not-use-in-prod',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd || isHttpsLocal,
      maxAge: 10 * 60 * 1000, // 10 min — OAuth state only needs to survive a redirect
    },
  })
);

// 5) Application routes
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/game', gameRoutes);
app.use('/programs', programRoutes);
app.use('/challenges', challengeRoutes);
app.use('/food', foodRoutes);
app.use('/game/settings', settingsRoutes);
app.use('/admin', adminRoutes);

// 6) Static web client — the Expo web export lives in ./public and is served at the
//    domain root, so the game is playable in a browser at the backend's own URL.
//    Mounted AFTER the API routes so those always take precedence.
const publicDir = path.join(__dirname, '../public');
const hasWebClient = fs.existsSync(path.join(publicDir, 'index.html'));
if (hasWebClient) {
  // LEVELED Tasks (todoist-app in Complete-Python-3-Bootcamp, built with
  // --base=/tasks/) lives under ./public/tasks. Mounted BEFORE the game's
  // SPA fallback, which would otherwise answer /tasks with the game.
  const tasksDir = path.join(publicDir, 'tasks');
  if (fs.existsSync(path.join(tasksDir, 'index.html'))) {
    app.use('/tasks', express.static(tasksDir));
    app.use('/tasks', (req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(tasksDir, 'index.html'));
    });
  }
  app.use(express.static(publicDir));
  // SPA fallback: any non-API GET returns index.html so the app boots on any path.
  // Written as a path-less middleware — Express 5's router rejects a bare '*' route.
  const API_PREFIXES = /^\/(health|auth|game|programs|challenges|food|admin|webhooks)(\/|$)/;
  app.use((req, res, next) => {
    if (req.method !== 'GET' || API_PREFIXES.test(req.path)) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// 6) Centralized error handler — never leak token contents.
//    express-rate-limit returns its own response, so this only catches downstream errors.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.error('[error]', status, err.message);
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
});

// ---- Listen ---------------------------------------------------------------

const PORT = parseInt(process.env.PORT || '3000', 10);

// Kick off the idempotent auto-seed once we're listening. Non-blocking so the
// health check passes immediately; a slow or failing seed never blocks boot.
function bootTasks() {
  // Telegram bot: self-registers its webhook when TELEGRAM_BOT_TOKEN is set.
  require('./services/telegram')
    .registerWebhook()
    .catch((err) => console.error('[telegram] register failed:', err.message));
  require('./db/ensureSeeded')
    .ensureSeeded()
    .catch((err) => console.error('[seed] auto-seed crashed (server still up):', err.message));
}

function listenHttp() {
  app.listen(PORT, () => {
    console.log(`[leveled] HTTP listening on http://localhost:${PORT}`);
    if (!isProd) {
      console.log(
        '[leveled] (HTTPS disabled — set TLS_CERT_PATH and TLS_KEY_PATH for HTTPS, see README)'
      );
    }
    bootTasks();
  });
}

function listenHttps() {
  const cert = fs.readFileSync(path.resolve(process.env.TLS_CERT_PATH));
  const key = fs.readFileSync(path.resolve(process.env.TLS_KEY_PATH));
  https.createServer({ cert, key }, app).listen(PORT, () => {
    console.log(`[leveled] HTTPS listening on https://localhost:${PORT}`);
    bootTasks();
  });
}

if (isProd) {
  // On Railway / Render / etc., the platform terminates TLS.
  listenHttp();
} else if (isHttpsLocal) {
  try {
    listenHttps();
  } catch (err) {
    console.error('[server] HTTPS startup failed:', err.message);
    console.error('[server] Falling back to HTTP (WHOOP OAuth requires HTTPS — see README).');
    listenHttp();
  }
} else {
  listenHttp();
}

module.exports = app;
