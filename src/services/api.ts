/**
 * Data adapter.
 *
 * The single seam between the UI and the rest of the system. Today it returns
 * the mock fixtures; as soon as VITE_API_BASE_URL is set (Chaima's backend), it
 * fetches from the live endpoints instead. No component needs to change.
 *
 * Domain: candidate terrestrial analog sites for Moon/Mars base locations
 * (predictions are analog-fit scores from Harshil's pipeline).
 *
 * Expected backend endpoints:
 *   GET    {base}/predictions   -> Prediction[]
 *   GET    {base}/datasets      -> DataSource[]
 *   GET    {base}/space/objects -> OrbitalObject[]
 *   GET    {base}/community     -> CommunityState
 *   POST   {base}/community     -> one reported site / note / review / vote
 *   DELETE {base}/community/{id}-> remove one record
 *
 * Community writes are **local-first**: the browser store is written and
 * returned synchronously, and the backend call is attempted afterwards. A
 * failed sync downgrades to "saved in this browser" instead of losing the
 * researcher's report, which is the failure mode that actually matters here.
 */

import {
  mockDatasets,
  mockOrbitalObjects,
  mockPredictions,
} from '../data-contracts/mock';
import type {
  CommunityState,
  DataSource,
  FieldNote,
  OrbitalObject,
  Prediction,
  ReportedSite,
  SiteReview,
} from '../data-contracts/types';
import {
  addNote,
  addReview,
  loadCommunity,
  mergeCommunity,
  normalizeCommunity,
  removeRecord,
  saveCommunity,
  toggleVote,
  upsertReportedSite,
} from '../lib/community';

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

/* --------------------------------------------------------------------------
 * Community
 * ------------------------------------------------------------------------ */

/** Result of a community write: the new state plus whether the backend has it. */
export interface CommunityWrite {
  state: CommunityState;
  /**
   * `true` when the record exists beyond this browser (or when no backend is
   * configured, in which case there is nothing to sync and the UI stays quiet).
   */
  synced: boolean;
}

/** Fire-and-forget backend write. Network problems never throw at the caller. */
async function sync(method: 'POST' | 'DELETE', path: string, body?: unknown): Promise<boolean> {
  if (!API_BASE) return true;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Persists locally and returns the state the UI should render. */
function commit(state: CommunityState, synced: boolean): CommunityWrite {
  saveCommunity(state);
  return { state, synced };
}

/** Local store merged with the backend's, when there is a backend. */
export async function getCommunityState(): Promise<CommunityState> {
  const local = loadCommunity();
  if (!API_BASE) return local;
  try {
    const res = await fetch(`${API_BASE}/community`);
    if (!res.ok) return local;
    const remote = normalizeCommunity(await res.json());
    const merged = mergeCommunity(local, remote);
    saveCommunity(merged);
    return merged;
  } catch {
    // Keep working offline: the local store is the source of truth until the
    // backend is reachable again, and the next successful read re-merges.
    return local;
  }
}

export async function saveReportedSite(
  current: CommunityState,
  site: ReportedSite,
): Promise<CommunityWrite> {
  const state = upsertReportedSite(current, site);
  // The backend upserts by id, so editing and creating share one call.
  const synced = await sync('POST', '/community', { kind: 'reportedSite', ...site });
  return commit(state, synced);
}

export async function deleteRecord(
  current: CommunityState,
  kind: 'reportedSites' | 'notes' | 'reviews',
  recordId: string,
): Promise<CommunityWrite> {
  const state = removeRecord(current, kind, recordId);
  const synced = await sync('DELETE', `/community/${encodeURIComponent(recordId)}`);
  return commit(state, synced);
}

export async function saveNote(
  current: CommunityState,
  note: FieldNote,
): Promise<CommunityWrite> {
  const state = addNote(current, note);
  const synced = await sync('POST', '/community', { kind: 'note', ...note });
  return commit(state, synced);
}

export async function saveReview(
  current: CommunityState,
  review: SiteReview,
): Promise<CommunityWrite> {
  const state = addReview(current, review);
  const synced = await sync('POST', '/community', { kind: 'review', ...review });
  return commit(state, synced);
}

export async function castVote(current: CommunityState, siteId: string): Promise<CommunityWrite> {
  const state = toggleVote(current, siteId);
  const voted = state.votes.some((vote) => vote.siteId === siteId);
  const synced = voted
    ? await sync('POST', '/community', { kind: 'vote', siteId })
    : await sync('DELETE', `/community/${encodeURIComponent(`${siteId}:this-browser`)}`);
  return commit(state, synced);
}
