/**
 * database.js — Mongoose connection + model definitions.
 *
 * Mirrors the Python-side MongoDB schema so both services share
 * the same collections without conflict.
 */

const mongoose = require('mongoose');

// ── Connection ────────────────────────────────────────────────────────────────

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Copy backend/.env.example to backend/.env and fill it in.'
    );
  }

  await mongoose.connect(uri, {
    dbName: process.env.DB_NAME || 'news_pulse',
  });

  isConnected = true;
  console.log(`[DB] Connected to MongoDB Atlas — db: ${process.env.DB_NAME || 'news_pulse'}`);

  mongoose.connection.on('error', (err) => {
    console.error('[DB] Mongoose error:', err);
    isConnected = false;
  });
}

// ── Schemas ───────────────────────────────────────────────────────────────────

/**
 * Article — written by the Python pipeline, read by the API.
 */
const articleSchema = new mongoose.Schema(
  {
    url:          { type: String, required: true, unique: true, index: true },
    title:        { type: String, default: '' },
    source:       { type: String, default: '' },
    summary:      { type: String, default: '' },
    content:      { type: String, default: '' },
    published_at: { type: Date,   index: true },
    cluster_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Cluster', index: true },
    created_at:   { type: Date,   default: Date.now },
  },
  {
    // Prevent Mongoose from creating a __v field
    versionKey: false,
    // Serialize _id as string 'id' for API responses
    toJSON: {
      virtuals: false,
      transform(_doc, ret) {
        ret.id = ret._id?.toString();
        delete ret._id;
      },
    },
  }
);

/**
 * Cluster — written by the Python pipeline, read by the API.
 * The `sources` array lists which news outlets contributed to this cluster.
 */
const clusterSchema = new mongoose.Schema(
  {
    label:         { type: String, default: 'Uncategorized' },
    article_count: { type: Number, default: 0 },
    start_time:    { type: Date },
    end_time:      { type: Date },
    sources:       { type: [String], default: [] },
    created_at:    { type: Date, default: Date.now },
  },
  {
    versionKey: false,
    toJSON: {
      virtuals: false,
      transform(_doc, ret) {
        ret.id = ret._id?.toString();
        delete ret._id;
      },
    },
  }
);

/**
 * IngestJob — created by Node.js, updated by Python pipeline.
 * Uses a UUID string as _id (set by Node.js at job creation time).
 */
const ingestJobSchema = new mongoose.Schema(
  {
    _id:              { type: String },   // UUID
    status:           { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued' },
    started_at:       { type: Date },
    completed_at:     { type: Date },
    new_articles:     { type: Number },
    clusters_updated: { type: Number },
    error_message:    { type: String },
  },
  {
    _id: false,    // prevent Mongoose from overriding our string _id
    versionKey: false,
    toJSON: {
      virtuals: false,
      transform(_doc, ret) {
        ret.jobId = ret._id;
        delete ret._id;
      },
    },
  }
);

// ── Models ────────────────────────────────────────────────────────────────────

const Article   = mongoose.models.Article   || mongoose.model('Article',   articleSchema,   'articles');
const Cluster   = mongoose.models.Cluster   || mongoose.model('Cluster',   clusterSchema,   'clusters');
const IngestJob = mongoose.models.IngestJob || mongoose.model('IngestJob', ingestJobSchema, 'ingest_jobs');

module.exports = { connectDB, Article, Cluster, IngestJob };
