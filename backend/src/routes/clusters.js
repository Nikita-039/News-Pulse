/**
 * clusters.js — Routes for browsing topic clusters and their articles.
 *
 * GET  /clusters        — paginated list of all clusters
 * GET  /clusters/:id    — full detail for one cluster + sorted articles
 */

const express = require('express');
const mongoose = require('mongoose');
const { Cluster, Article } = require('../db/database');

const router = express.Router();

// ── GET /clusters ─────────────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    const clusters = await Cluster.find()
      .sort({ start_time: -1 })
      .lean();

    const response = clusters.map((c) => ({
      id:           c._id.toString(),
      label:        c.label,
      articleCount: c.article_count,
      startTime:    c.start_time,
      endTime:      c.end_time,
      sources:      c.sources || [],
    }));

    return res.json(response);
  } catch (err) {
    console.error('[GET /clusters]', err);
    return res.status(500).json({ error: 'Failed to fetch clusters.' });
  }
});

// ── GET /clusters/:id ─────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  // Validate ObjectId format to avoid a Mongoose CastError
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid cluster ID format.' });
  }

  try {
    const cluster = await Cluster.findById(id).lean();
    if (!cluster) {
      return res.status(404).json({ error: `Cluster '${id}' not found.` });
    }

    // Fetch all articles belonging to this cluster, sorted chronologically
    const articles = await Article.find({ cluster_id: cluster._id })
      .sort({ published_at: 1 })
      .select('title source published_at url summary -_id')
      .lean();

    return res.json({
      id:           cluster._id.toString(),
      label:        cluster.label,
      articleCount: cluster.article_count,
      startTime:    cluster.start_time,
      endTime:      cluster.end_time,
      sources:      cluster.sources || [],
      articles:     articles.map((a) => ({
        title:       a.title,
        source:      a.source,
        publishedAt: a.published_at,
        url:         a.url,
        summary:     a.summary,
      })),
    });
  } catch (err) {
    console.error(`[GET /clusters/${id}]`, err);
    return res.status(500).json({ error: 'Failed to fetch cluster details.' });
  }
});

module.exports = router;
