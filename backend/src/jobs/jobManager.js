/**
 * jobManager.js — In-memory registry of running ingestion sub-processes.
 *
 * Complements the MongoDB ingest_jobs collection:
 *   - MongoDB stores persistent status (survives restarts, readable by Python).
 *   - In-memory map stores the live child_process handle for the current session.
 *
 * Only one concurrent ingestion job is allowed. Attempting to start a second
 * while one is already running returns a 409 Conflict.
 */

/** @type {Map<string, import('child_process').ChildProcess>} */
const activeJobs = new Map();

/**
 * Register a newly spawned child process.
 * @param {string} jobId - UUID
 * @param {import('child_process').ChildProcess} proc
 */
function registerJob(jobId, proc) {
  activeJobs.set(jobId, proc);
}

/**
 * Remove a job from the in-memory registry (called on exit / error).
 * @param {string} jobId
 */
function unregisterJob(jobId) {
  activeJobs.delete(jobId);
}

/**
 * Returns true if any ingestion job is currently running.
 */
function isAnyJobRunning() {
  return activeJobs.size > 0;
}

/**
 * Returns the child_process handle for jobId, or undefined.
 * @param {string} jobId
 * @returns {import('child_process').ChildProcess | undefined}
 */
function getJob(jobId) {
  return activeJobs.get(jobId);
}

module.exports = { registerJob, unregisterJob, isAnyJobRunning, getJob };
