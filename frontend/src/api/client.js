/**
 * client.js — Axios API wrappers for the News Pulse backend.
 * All calls use the /api prefix which Vite proxies to http://localhost:5000.
 */

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Clusters ───────────────────────────────────────────────────────────────────

/** Fetch summary list of all clusters. */
export const getClusters = () => api.get('/clusters');

/** Fetch full cluster detail including articles. */
export const getCluster = (id) => api.get(`/clusters/${id}`);

// ── Timeline ───────────────────────────────────────────────────────────────────

/** Fetch timeline-formatted cluster data. */
export const getTimeline = () => api.get('/timeline');

// ── Ingestion ──────────────────────────────────────────────────────────────────

/** Trigger a new ingestion job. Returns { jobId, status }. */
export const triggerIngest = () => api.post('/ingest/trigger');

/** Poll the status of an ingestion job. */
export const getIngestStatus = (jobId) => api.get(`/ingest/status/${jobId}`);

export default api;
