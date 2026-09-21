/**
 * timeline.js — Returns data formatted for the frontend timeline visualisation.
 *
 * GET /timeline
 *
 * Each item in the response represents one topic cluster, with:
 *   - start/end timestamps for the timeline bar span
 *   - intensity = article_count (used for visual sizing / colour)
 *   - sources array for the source filter
 */

const express = require('express');
const { Cluster } = require('../db/database');

const router = express.Router();

// ── GET /timeline ─────────────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    const clusters = await Cluster.find()
      .sort({ start_time: 1 })
      .lean();

    const data = clusters.map((c) => ({
      id:           c._id.toString(),
      label:        c.label,
      startTime:    c.start_time,
      endTime:      c.end_time,
      articleCount: c.article_count,
      intensity:    c.article_count,   // stretch goal: used for marker sizing
      sources:      c.sources || [],
    }));

    return res.json({ data });
  } catch (err) {
    console.error('[GET /timeline]', err);
    return res.status(500).json({ error: 'Failed to fetch timeline data.' });
  }
});

module.exports = router;
