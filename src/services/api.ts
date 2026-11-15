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
import { engineComparisons, pipelineDatasets, screenedPredictions } from './pipeline';
import type {
  CommunityState,
  DimensionStates,
  EvidenceState,
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

/**
 * The engine's verdict for the site of that name, if it has run on it.
 *
 * Harshil's reports are the only evidence in the repository produced by the
 * comparison engine, and they cover one candidate. Attaching them here is what
 * puts that work in the ranked list rather than only in a panel: a row now says
 * whether the engine found the ground similar, different, or unable to decide.
 */
/**
 * A name with its decorations taken off: "Atacama Desert (Chile)" and
 * "Atacama Desert, Chile" are the same site to a reader, so they are the same
 * site to this lookup. Matching the raw strings attached the engine's verdict to
 * nothing at all.
 */
const normaliseName = (value: string) =>
  value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const DIMENSION_KEY: Record<string, keyof DimensionStates> = {
  terrain_topography: 'terrain',
  surface_geology: 'geology',
  temperature_thermal: 'thermal',
};

/** Only the engine words that are one of the four states survive the trip. */
const STATUS_STATE: Record<string, EvidenceState | undefined> = {
  similar: 'similar',
  qualitative_match: 'similar',
  different: 'different',
  insufficient_evidence: 'insufficient_evidence',
  not_comparable: 'not_comparable',
};

const ENGINE_BY_SITE = engineComparisons.map((comparison) => ({
  comparison,
  key: normaliseName(comparison.candidate),
}));

function withEngineState(prediction: Prediction): Prediction {
  if (prediction.dimensionStates) return prediction;
  const name = normaliseName(prediction.siteName);
  const hit = ENGINE_BY_SITE.find(
    (entry) => name === entry.key || name.startsWith(entry.key) || entry.key.startsWith(name),
  )?.comparison;
  if (!hit) return prediction;

  const states: DimensionStates = {};
  for (const dimension of hit.dimensions) {
    const key = DIMENSION_KEY[dimension.id];
    const state = STATUS_STATE[dimension.status.toLowerCase()];
    // `mixed` is the engine's word for a dimension that came back partly
    // similar and partly different. It is not one of the four states, so it
    // falls through to the classifier, which decides terrain from the overlap
    // ratio itself rather than picking whichever part is convenient.
    if (key && state) states[key] = state;
  }

  const note = hit.dimensions
    .map(
      (dimension) =>
        `${dimension.id.replace(/_/g, ' ')} ${dimension.status.replace(/_/g, ' ').toLowerCase()}`,
    )
    .join(', ');

  return {
    ...prediction,
    dimensionStates: { [hit.target]: states } as Partial<Record<'moon' | 'mars', DimensionStates>>,
    evidenceNote: `Engine ${hit.engineVersion} against ${hit.targetRegion}: ${note}.`,
  };
}

export function getPredictions(): Promise<Prediction[]> {
  /**
   * Screened cells first, then the fixtures.
   *
   * The ranking sorts by fit anyway, so order here is not the ranking: what
   * matters is that a row derived from the SRTM grid is in the same queue as a
   * hand-written one, carrying the evidence state that says which is which.
   */
  const built = [...screenedPredictions, ...mockPredictions].map(withEngineState);
  return fetchJson<Prediction[]>('/predictions', built);
}

/**
 * The catalogue the pipeline publishes in `docs/dataset_catalog.csv`, read at
 * build time. The fixtures stay as the fallback for a checkout without the
 * catalog, so the sources panel is never empty.
 */
export function getDatasets(): Promise<DataSource[]> {
  return fetchJson<DataSource[]>(
    '/datasets',
    pipelineDatasets.length > 0 ? pipelineDatasets : mockDatasets,
  );
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
