/**
 * app.js — Express application factory.
 * Wires up middleware, CORS, and all routes.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const clustersRouter = require('./routes/clusters');
const timelineRouter = require('./routes/timeline');
const ingestRouter   = require('./routes/ingest');

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST'],
}));
app.use(express.json());

// Request logger (dev)
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method}  ${req.url}`);
  next();
});

// ── Routes ─────────────────────────────────────────────────────────────────────

app.use('/clusters', clustersRouter);
app.use('/timeline', timelineRouter);
app.use('/ingest',   ingestRouter);

// Health-check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// 404
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Unhandled error]', err);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

module.exports = app;
