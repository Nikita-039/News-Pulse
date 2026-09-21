/**
 * useIngestion.js — Hook that triggers the Python pipeline and polls
 * for job completion, then resolves with a callback to reload timeline data.
 *
 * Usage:
 *   const { trigger, status, isRunning, error } = useIngestion(onComplete);
 */

import { useState, useRef, useCallback } from 'react';
import { triggerIngest, getIngestStatus } from '../api/client';

const POLL_INTERVAL_MS = 2_000;
const TERMINAL_STATUSES = new Set(['completed', 'failed']);

/**
 * @param {() => void} onComplete - Called after a successful ingestion.
 */
export function useIngestion(onComplete) {
  const [status, setStatus] = useState(null);     // null | 'queued' | 'running' | 'completed' | 'failed'
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);

  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((jobId) => {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await getIngestStatus(jobId);
        setStatus(data.status);

        if (data.status === 'completed') {
          setSummary(data.summary);
          stopPolling();
          setIsRunning(false);
          onComplete?.();
        } else if (data.status === 'failed') {
          setError(data.error || 'Ingestion pipeline failed.');
          stopPolling();
          setIsRunning(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
        // Don't stop polling on transient network errors
      }
    }, POLL_INTERVAL_MS);
  }, [onComplete, stopPolling]);

  const trigger = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    setStatus('queued');
    setError(null);
    setSummary(null);

    try {
      const { data } = await triggerIngest();
      setStatus(data.status);
      startPolling(data.jobId);
    } catch (err) {
      const msg =
        err.response?.status === 409
          ? 'An ingestion job is already running.'
          : err.response?.data?.error || 'Failed to start ingestion.';
      setError(msg);
      setStatus('failed');
      setIsRunning(false);
    }
  }, [isRunning, startPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setStatus(null);
    setIsRunning(false);
    setError(null);
    setSummary(null);
  }, [stopPolling]);

  return { trigger, status, isRunning, error, summary, reset };
}
