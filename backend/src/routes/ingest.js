/**
 * ingest.js — Routes for triggering and monitoring the Python pipeline.
 *
 * POST /ingest/trigger         — spawn the Python pipeline asynchronously
 * GET  /ingest/status/:jobId   — check job status from MongoDB
 */

const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const { IngestJob } = require('../db/database');
const { registerJob, unregisterJob, isAnyJobRunning } = require('../jobs/jobManager');

const router = express.Router();

// Absolute path to the pipeline script and its working directory
const SCRAPER_DIR = path.resolve(__dirname, '../../../scraper');
const PIPELINE_SCRIPT = path.join(SCRAPER_DIR, 'pipeline.py');
const PYTHON_CMD = process.env.PYTHON_CMD || 'python';

// Log resolved paths at startup for easy debugging
console.log('[Ingest] SCRAPER_DIR:', SCRAPER_DIR);
console.log('[Ingest] PIPELINE_SCRIPT:', PIPELINE_SCRIPT);
console.log('[Ingest] PYTHON_CMD:', PYTHON_CMD);

// ── POST /ingest/trigger ──────────────────────────────────────────────────────

router.post('/trigger', async (_req, res) => {
  // Prevent concurrent runs
  if (isAnyJobRunning()) {
    return res.status(409).json({
      error: 'An ingestion job is already running. Please wait for it to complete.',
    });
  }

  const jobId = uuidv4();

  // Create job record in MongoDB (Python will update it as it progresses)
  try {
    await IngestJob.create({ _id: jobId, status: 'queued' });
  } catch (err) {
    console.error('[POST /ingest/trigger] Failed to create job record:', err);
    return res.status(500).json({ error: 'Could not create ingest job.' });
  }

  // Spawn Python pipeline as a detached background process
  let proc;
  try {
    proc = spawn(PYTHON_CMD, [PIPELINE_SCRIPT, '--job-id', jobId], {
      cwd: SCRAPER_DIR,        // important: Python imports resolve from here
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (spawnErr) {
    console.error('[POST /ingest/trigger] spawn failed:', spawnErr);
    await IngestJob.findByIdAndUpdate(jobId, {
      status: 'failed',
      error_message: spawnErr.message,
    });
    return res.status(500).json({ error: 'Failed to start pipeline process.' });
  }

  registerJob(jobId, proc);
  console.log(`[Ingest] Job ${jobId} started (PID ${proc.pid})`);

  // Log pipeline stdout/stderr for debugging
  proc.stdout?.on('data', (data) => process.stdout.write(`[Pipeline] ${data}`));
  proc.stderr?.on('data', (data) => process.stderr.write(`[Pipeline ERR] ${data}`));

  proc.on('error', async (err) => {
    console.error(`[Ingest] Job ${jobId} process error:`, err);
    unregisterJob(jobId);
    await IngestJob.findByIdAndUpdate(jobId, {
      status: 'failed',
      error_message: err.message,
      completed_at: new Date(),
    }).catch(() => {});
  });

  proc.on('close', (code) => {
    console.log(`[Ingest] Job ${jobId} exited with code ${code}`);
    unregisterJob(jobId);
    // Python pipeline writes its own final status — we only override here
    // if the process exited with a non-zero code AND Python didn't update.
    if (code !== 0) {
      IngestJob.findByIdAndUpdate(
        jobId,
        { $setOnInsert: { status: 'failed', error_message: `Process exited with code ${code}` } },
        { upsert: false }
      ).catch(() => {});
    }
  });

  // Respond immediately — don't wait for pipeline to finish
  return res.status(202).json({ jobId, status: 'queued' });
});

// ── GET /ingest/status/:jobId ─────────────────────────────────────────────────

router.get('/status/:jobId', async (req, res) => {
  const { jobId } = req.params;

  // Basic UUID format check
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(jobId)) {
    return res.status(400).json({ error: 'Invalid job ID format.' });
  }

  try {
    const job = await IngestJob.findById(jobId).lean();
    if (!job) {
      return res.status(404).json({ error: `Job '${jobId}' not found.` });
    }

    const response = {
      jobId:       job._id,
      status:      job.status,
      startedAt:   job.started_at,
      completedAt: job.completed_at,
    };

    if (job.status === 'completed') {
      response.summary = {
        newArticles:     job.new_articles,
        clustersUpdated: job.clusters_updated,
      };
    }

    if (job.status === 'failed') {
      response.error = job.error_message;
    }

    return res.json(response);
  } catch (err) {
    console.error(`[GET /ingest/status/${jobId}]`, err);
    return res.status(500).json({ error: 'Failed to fetch job status.' });
  }
});

module.exports = router;
