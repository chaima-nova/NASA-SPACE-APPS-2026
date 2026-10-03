/**
 * Data adapter.
 *
 * The single seam between the UI and the rest of the system. Today it returns
 * the mock fixtures; as soon as VITE_API_BASE_URL is set (Chaima's backend), it
 * fetches from the live endpoints instead. No component needs to change.
 *
 * Expected backend endpoints:
 *   GET {base}/predictions   -> Prediction[]
 *   GET {base}/datasets      -> DataSource[]
 *   GET {base}/space/objects -> OrbitalObject[]
 */

import {
  mockDatasets,
  mockOrbitalObjects,
  mockPredictions,
} from '../data-contracts/mock';
import type { DataSource, OrbitalObject, Prediction } from '../data-contracts/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? '';

/** True while the shell is running on built-in sample data. */
export const usingMockData = API_BASE === '';

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  if (!API_BASE) return fallback;
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status} ${res.statusText}) for ${path}`);
  }
  return (await res.json()) as T;
}

export function getPredictions(): Promise<Prediction[]> {
  return fetchJson<Prediction[]>('/predictions', mockPredictions);
}

export function getDatasets(): Promise<DataSource[]> {
  return fetchJson<DataSource[]>('/datasets', mockDatasets);
}

export function getOrbitalObjects(): Promise<OrbitalObject[]> {
  return fetchJson<OrbitalObject[]>('/space/objects', mockOrbitalObjects);
}
