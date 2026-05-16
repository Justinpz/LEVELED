'use strict';

/**
 * WHOOP webhook receiver — Phase 1 STUB.
 *
 * Verifies the HMAC signature and acks with 200. No event processing yet;
 * that comes in Phase 2 (sync recoveries, sleeps, cycles, workouts).
 *
 * Signature scheme (per WHOOP docs):
 *   HMAC-SHA256(WHOOP_WEBHOOK_SECRET, timestamp + raw_body)  →  base64
 *   compared in constant time against the X-Whoop-Signature header.
 *
 * IMPORTANT: this route uses express.raw() locally — the global express.json()
 * parser in server.js is mounted AFTER /webhooks, so raw body is preserved.
 */

const crypto = require('crypto');
const express = require('express');

const router = express.Router();

router.post(
  '/whoop',
  express.raw({ type: '*/*', limit: '1mb' }),
  (req, res) => {
    const signature = req.get('x-whoop-signature');
    const timestamp = req.get('x-whoop-signature-timestamp');
    const secret = process.env.WHOOP_WEBHOOK_SECRET;

    if (!signature || !timestamp) {
      return res.status(401).json({ error: 'Missing signature headers' });
    }
    if (!secret) {
      console.error('[webhook:whoop] WHOOP_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const signedBlob = timestamp + payload.toString('utf8');
    const expected = crypto.createHmac('sha256', secret).update(signedBlob).digest('base64');

    let valid = false;
    try {
      const a = Buffer.from(signature);
      const b = Buffer.from(expected);
      valid = a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch (_) {
      valid = false;
    }

    if (!valid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let event;
    try {
      event = JSON.parse(payload.toString('utf8'));
    } catch (_) {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    // Phase 1: log and ack. Phase 2 will route by event.type.
    console.log(
      '[webhook:whoop]',
      JSON.stringify({
        type: event.type,
        user_id: event.user_id,
        id: event.id,
        trace_id: event.trace_id,
      })
    );

    res.status(200).json({ ok: true });
  }
);

module.exports = router;
