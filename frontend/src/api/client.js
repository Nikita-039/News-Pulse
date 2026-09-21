/**
 * client.js — Axios API wrappers for the News Pulse backend.
 *
 * Local dev:  Vite proxies /api → http://localhost:5000  (baseURL = '/api')
 * Production: VITE_API_BASE_URL points directly to the Render backend URL
 */

import axios from 'axios';

// In production VITE_API_BASE_URL = 'https://news-pulse-backend-j25i.onrender.com'
// In local dev it is undefined, so we fall back to '/api' (Vite proxy)
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL,
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
