'use strict';

const express = require('express');
const router = express.Router();

// GET /health — used by Railway health checks and local smoke tests.
router.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
