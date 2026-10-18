/**
 * Community layer: researcher reports, field notes, reviews and upvotes.
 *
 * There is no backend in the demo, so everything is persisted in
 * `localStorage` under one versioned key and merged with whatever the backend
 * returns when `VITE_API_BASE_URL` is set. The rules that matter:
 *
 *  - Storage is always defensive. A hand-edited or half-written entry must
 *    never break the page: unknown shapes are dropped record by record rather
 *    than taking the whole store down.
 *  - Records carry their `source`, so the UI can offer delete only for things
 *    this browser wrote and never claim someone else's note as its own.
 *  - Reported sites carry no scores. They are not predictions and must not be
 *    ranked against the model's output.
 */

import type {
  CommunityState,
  FieldNote,
  ReportedSite,
  SiteReview,
  SiteVote,
  TerrainType,
} from '../data-contracts/types';
import { TERRAIN_ORDER } from './site';

/** Bumped only when the stored shape changes incompatibly. */
const STORAGE_KEY = 'earth-analogs.community.v1';

/**
 * Voter id for this browser. Anonymous and local: it exists so the upvote
 * button can be a toggle rather than a counter that grows without bound.
 */
export const LOCAL_VOTER = 'this-browser';

export const EMPTY_COMMUNITY: CommunityState = {
  reportedSites: [],
  notes: [],
  reviews: [],
  votes: [],
};

function id(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

/* --------------------------------------------------------------------------
 * Validation on read
 * ------------------------------------------------------------------------ */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

const num = (value: unknown, lo: number, hi: number): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= lo && value <= hi
    ? value
    : undefined;

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const terrain = (value: unknown): TerrainType | undefined =>
  TERRAIN_ORDER.includes(value as TerrainType) ? (value as TerrainType) : undefined;

function readReported(value: unknown): ReportedSite | null {
  if (!isRecord(value)) return null;
  const lat = num(value.lat, -90, 90);
  const lon = num(value.lon, -180, 180);
  const name = str(value.name);
  const reporter = str(value.reporter);
  if (lat === undefined || lon === undefined || !name || !reporter) return null;
  const focusArea =
    value.focusArea === 'mars-base-analog' || value.focusArea === 'moon-base-analog'
      ? value.focusArea
      : 'dual-analog';
  const targets = list(value.targets).filter((t) => t === 'moon' || t === 'mars') as Array<
    'moon' | 'mars'
  >;
  return {
    id: str(value.id) ?? id('rep'),
    name,
    lat,
    lon,
    region: str(value.region),
    terrainType: terrain(value.terrainType),
    focusArea,
    elevationM: num(value.elevationM, -500, 9000),
    targets: targets.length > 0 ? targets : ['moon'],
    evidence: str(value.evidence) ?? '',
    photoUrl: str(value.photoUrl),
    reporter,
    submittedAt: str(value.submittedAt) ?? new Date().toISOString(),
    // Anything that survived in this browser's store was written here.
    source: 'local',
  };
}

function readNote(value: unknown): FieldNote | null {
  if (!isRecord(value)) return null;
  const siteId = str(value.siteId);
  const text = str(value.text);
  const author = str(value.author);
  if (!siteId || !text || !author) return null;
  return {
    id: str(value.id) ?? id('note'),
    siteId,
    author,
    observedAt: str(value.observedAt) ?? new Date().toISOString().slice(0, 10),
    text,
    photoUrl: str(value.photoUrl),
    createdAt: str(value.createdAt) ?? new Date().toISOString(),
    source: value.source === 'remote' ? 'remote' : 'local',
  };
}

function readReview(value: unknown): SiteReview | null {
  if (!isRecord(value)) return null;
  const siteId = str(value.siteId);
  const text = str(value.text);
  const author = str(value.author);
  if (!siteId || !text || !author) return null;
  return {
    id: str(value.id) ?? id('review'),
    siteId,
    author,
    text,
    createdAt: str(value.createdAt) ?? new Date().toISOString(),
    source: value.source === 'remote' ? 'remote' : 'local',
  };
}

function readVote(value: unknown): SiteVote | null {
  if (!isRecord(value)) return null;
  const siteId = str(value.siteId);
  const voter = str(value.voter);
  if (!siteId || !voter) return null;
  return {
    siteId,
    voter,
    createdAt: str(value.createdAt) ?? new Date().toISOString(),
    source: value.source === 'remote' ? 'remote' : 'local',
  };
}

function compact<T>(items: Array<T | null>): T[] {
  return items.filter((item): item is T => item !== null);
}

/** Turns any parsed JSON into a valid `CommunityState`, dropping bad records. */
export function normalizeCommunity(value: unknown): CommunityState {
  if (!isRecord(value)) return { ...EMPTY_COMMUNITY };
  return {
    reportedSites: compact(list(value.reportedSites).map(readReported)),
    notes: compact(list(value.notes).map(readNote)),
    reviews: compact(list(value.reviews).map(readReview)),
    votes: compact(list(value.votes).map(readVote)),
  };
}

/* --------------------------------------------------------------------------
 * localStorage
 * ------------------------------------------------------------------------ */

/** True when the browser allows storage (private modes can refuse). */
function storage(): Storage | null {
  try {
    const probe = '__earth-analogs__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadCommunity(): CommunityState {
  const store = storage();
  if (!store) return { ...EMPTY_COMMUNITY };
  try {
    const raw = store.getItem(STORAGE_KEY);
    return raw ? normalizeCommunity(JSON.parse(raw)) : { ...EMPTY_COMMUNITY };
  } catch {
    return { ...EMPTY_COMMUNITY };
  }
}

/** Returns false when the write failed (quota, private mode). */
export function saveCommunity(state: CommunityState): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * Backend records win nothing: local edits and remote records are unioned by
 * key, and a record present in both keeps the local copy so an in-flight edit
 * is never reverted by a stale fetch.
 */
export function mergeCommunity(local: CommunityState, remote: CommunityState): CommunityState {
  const byKey = <T>(key: (item: T) => string) => (a: T[], b: T[]): T[] => {
    const seen = new Map<string, T>();
    for (const item of b) seen.set(key(item), item);
    for (const item of a) seen.set(key(item), item);
    return [...seen.values()];
  };
  return {
    reportedSites: byKey<ReportedSite>((r) => r.id)(local.reportedSites, remote.reportedSites),
    notes: byKey<FieldNote>((n) => n.id)(local.notes, remote.notes),
    reviews: byKey<SiteReview>((r) => r.id)(local.reviews, remote.reviews),
    votes: byKey<SiteVote>((v) => `${v.siteId}:${v.voter}`)(local.votes, remote.votes),
  };
}

/* --------------------------------------------------------------------------
 * Mutations (pure: they return a new state)
 * ------------------------------------------------------------------------ */

export type ReportInput = {
  name: string;
  lat: number;
  lon: number;
  region?: string;
  terrainType: TerrainType;
  focusArea: ReportedSite['focusArea'];
  elevationM?: number;
  evidence: string;
  photoUrl?: string;
  reporter: string;
};

export function createReportedSite(input: ReportInput, now = new Date()): ReportedSite {
  const targets: Array<'moon' | 'mars'> =
    input.focusArea === 'moon-base-analog'
      ? ['moon']
      : input.focusArea === 'mars-base-analog'
        ? ['mars']
        : ['moon', 'mars'];
  return {
    id: id('rep'),
    name: input.name.trim(),
    lat: input.lat,
    lon: input.lon,
    region: input.region?.trim() || undefined,
    terrainType: input.terrainType,
    focusArea: input.focusArea,
    elevationM: input.elevationM,
    targets,
    evidence: input.evidence.trim(),
    photoUrl: input.photoUrl?.trim() || undefined,
    reporter: input.reporter.trim(),
    submittedAt: now.toISOString(),
    source: 'local',
  };
}

export function upsertReportedSite(state: CommunityState, site: ReportedSite): CommunityState {
  const exists = state.reportedSites.some((r) => r.id === site.id);
  return {
    ...state,
    reportedSites: exists
      ? state.reportedSites.map((r) => (r.id === site.id ? site : r))
      : [site, ...state.reportedSites],
  };
}

export function removeRecord(
  state: CommunityState,
  kind: 'reportedSites' | 'notes' | 'reviews',
  recordId: string,
): CommunityState {
  if (kind === 'reportedSites') {
    return { ...state, reportedSites: state.reportedSites.filter((r) => r.id !== recordId) };
  }
  if (kind === 'notes') {
    return { ...state, notes: state.notes.filter((n) => n.id !== recordId) };
  }
  return { ...state, reviews: state.reviews.filter((r) => r.id !== recordId) };
}

export function addNote(state: CommunityState, note: FieldNote): CommunityState {
  return { ...state, notes: [note, ...state.notes] };
}

export function addReview(state: CommunityState, review: SiteReview): CommunityState {
  return { ...state, reviews: [review, ...state.reviews] };
}

/** Adds or removes this browser's vote for a site; returns the new state. */
export function toggleVote(
  state: CommunityState,
  siteId: string,
  voter = LOCAL_VOTER,
  now = new Date(),
): CommunityState {
  const mine = state.votes.some((vote) => vote.siteId === siteId && vote.voter === voter);
  return {
    ...state,
    votes: mine
      ? state.votes.filter((vote) => !(vote.siteId === siteId && vote.voter === voter))
      : [{ siteId, voter, createdAt: now.toISOString(), source: 'local' }, ...state.votes],
  };
}

export function makeNote(
  input: { siteId: string; author: string; observedAt: string; text: string; photoUrl?: string },
  now = new Date(),
): FieldNote {
  return {
    id: id('note'),
    siteId: input.siteId,
    author: input.author.trim(),
    observedAt: input.observedAt || now.toISOString().slice(0, 10),
    text: input.text.trim(),
    photoUrl: input.photoUrl?.trim() || undefined,
    createdAt: now.toISOString(),
    source: 'local',
  };
}

export function makeReview(
  input: { siteId: string; author: string; text: string },
  now = new Date(),
): SiteReview {
  return {
    id: id('review'),
    siteId: input.siteId,
    author: input.author.trim(),
    text: input.text.trim(),
    createdAt: now.toISOString(),
    source: 'local',
  };
}

/* --------------------------------------------------------------------------
 * Selectors + export
 * ------------------------------------------------------------------------ */

export function notesFor(state: CommunityState, siteId: string): FieldNote[] {
  return state.notes
    .filter((note) => note.siteId === siteId)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
}

export function reviewsFor(state: CommunityState, siteId: string): SiteReview[] {
  return state.reviews
    .filter((review) => review.siteId === siteId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function votesFor(state: CommunityState, siteId: string): SiteVote[] {
  return state.votes.filter((vote) => vote.siteId === siteId);
}

export function hasVoted(state: CommunityState, siteId: string, voter = LOCAL_VOTER): boolean {
  return state.votes.some((vote) => vote.siteId === siteId && vote.voter === voter);
}

export function reportsCsv(sites: ReportedSite[]): string {
  const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const header = [
    'site',
    'region',
    'terrain',
    'lat',
    'lon',
    'elevation_m',
    'targets',
    'focus_area',
    'reporter',
    'submitted_at',
    'photo_url',
    'evidence',
  ];
  const rows = sites.map((site) =>
    [
      site.name,
      site.region ?? '',
      site.terrainType ?? '',
      site.lat.toFixed(4),
      site.lon.toFixed(4),
      site.elevationM ?? '',
      site.targets.join('+'),
      site.focusArea,
      site.reporter,
      site.submittedAt,
      site.photoUrl ?? '',
      site.evidence,
    ]
      .map(cell)
      .join(','),
  );
  return [header.map(cell).join(','), ...rows].join('\r\n');
}

/** Round-trip format for the "Manage" panel, so reports survive a reinstall. */
export function reportsJson(sites: ReportedSite[]): string {
  return JSON.stringify({ version: 1, reportedSites: sites }, null, 2);
}
