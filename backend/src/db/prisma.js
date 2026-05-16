'use strict';

// Single shared PrismaClient instance.
// Importing PrismaClient multiple times opens redundant connection pools
// against Postgres — bad in dev, worse in serverless. Always import this.

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['warn', 'error'],
});

module.exports = prisma;
