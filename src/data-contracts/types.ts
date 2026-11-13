/**
 * Shared data contracts.
 *
 * These types are the interface between the visualization shell and the rest of
 * the team's modules. They are intentionally provider-agnostic:
 *
 *   Abid  (NASA data)      -> DataSource[]            (GET /datasets)
 *   Farwa (geospatial)     -> GeoPoint[]              (embedded in predictions today)
 *   Harshil (ML)           -> Prediction[]            (GET /predictions)
 *   Zehra (space systems)  -> OrbitalObject[]         (GET /space/objects)
 *
 * Challenge: identify Earth locations that analog the permanent Moon base
 * locations and Mars. The shell visualises candidate terrestrial analog sites
 * and the analog-fit scores the rest of the pipeline produces.
 *
 * If the backend field names change, update ONLY this file + src/services/api.ts.
 */

export type FocusArea =
  | 'moon-base-analog'
  | 'mars-base-analog'
  | 'dual-analog';

/** Terrain families named in the challenge brief. */
export type TerrainType =
  | 'desert'
  | 'arid'
  | 'polar'
  | 'volcanic'
  | 'cave'
  | 'impact'
  | 'fluvial';

/** One NASA (or partner-agency) dataset, as catalogued by Abid. */
export interface DataSource {
  id: string;
  name: string;
  /** e.g. "NASA" / "NASA Earthdata" / "NASA PDS" */
  provider: string;
  /** e.g. "MODIS", "Landsat 9 OLI", "LRO Diviner", "HiRISE" */
  instrument?: string;
  url: string;
  focusAreas: FocusArea[];
  /** Variable names available in the dataset. */
  variables: string[];
  temporalResolution?: string;
  spatialResolution?: string;
  /** ISO-8601 */
  retrievedAt: string;
}

/** A geospatial candidate site / feature vector prepared by Farwa. */
export interface GeoPoint {
  id: string;
  /** Human-readable site name, e.g. "Atacama Desert, Chile". */
  name: string;
  lat: number;
  lon: number;
  focusArea: FocusArea;
  /** Named geospatial features. Numbers only so Harshil can train directly. */
  features: Record<string, number>;
  /** Optional: terrain family, used by the discovery filters. */
  terrainType?: TerrainType;
  /** Optional: human-readable region, e.g. "Antofagasta, Chile". */
  region?: string;
  /** Optional: mean elevation in metres. */
  elevationM?: number;
}

/** One analog-fit inference result produced by Harshil's pipeline. */
export interface Prediction {
  id: string;
  /** Links back to the GeoPoint this prediction covers. */
  pointId: string;
  /** Site name, carried through for labelling on the map. */
  siteName: string;
  lat: number;
  lon: number;
  focusArea: FocusArea;
  model: {
    id: string;
    version: string;
  };
  /** ISO-8601 */
  predictedAt: string;
  /** Primary analog-fit score in [0, 1]. Higher = better terrestrial analog. */
  analogScore: number;
  /** Optional sister score for Moon base sites specifically, [0, 1]. */
  moonFit?: number;
  /** Optional sister fit for Mars base sites specifically, [0, 1]. */
  marsFit?: number;
  /** Optional terrain family, carried through from the GeoPoint. */
  terrainType?: TerrainType;
  /** Optional region label. */
  region?: string;
  /** Optional mean elevation in metres. */
  elevationM?: number;
  /**
   * Optional per-axis scores for the proposal's four pillars, each in [0, 1]:
   * geomorphology (slope, crater density), mineralogy (sulfates, iron oxides),
   * environment (UV, aridity, thermal swing) and logistics (access to roads and
   * power). When absent the dossier derives them from `featureContributions` so
   * the UI is never blocked on the model.
   */
  factors?: {
    geomorphology: number;
    mineralogy: number;
    environment: number;
    logistics: number;
  };
  /** Optional provenance links into DataSource[]. */
  datasetIds?: string[];
  /** Optional one-sentence plain-language verdict. */
  verdict?: string;
  /** Human-readable bucket, e.g. "Strong" / "Promising" / "Weak". */
  label: string;
  /** Model confidence in [0, 1]. */
  confidence: number;
  /** Feature name -> signed contribution to the score. */
  featureContributions: Record<string, number>;
}

/** Where a record came from: this browser, or a shared backend. */
export type RecordSource = 'local' | 'remote';

/**
 * A candidate site reported by a researcher rather than produced by the model
 * pipeline. Reported sites deliberately carry **no** analog-fit scores: nobody
 * has run the features through Harshil's model yet, so showing a number here
 * would be inventing one. They are listed apart from the ranked queue and
 * labelled as unreviewed until someone scores them.
 */
export interface ReportedSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  region?: string;
  terrainType?: TerrainType;
  focusArea: FocusArea;
  elevationM?: number;
  /** Which worlds the reporter is proposing this site as an analog for. */
  targets: Array<'moon' | 'mars'>;
  /** Field evidence: what was seen, sampled or measured. */
  evidence: string;
  /** Optional ground photo of the site. */
  photoUrl?: string;
  reporter: string;
  /** ISO-8601 */
  submittedAt: string;
  source: RecordSource;
}

/** A dated researcher observation attached to any site. */
export interface FieldNote {
  id: string;
  /** Prediction id, or a ReportedSite id. */
  siteId: string;
  author: string;
  /** ISO date (YYYY-MM-DD) the observation was made. */
  observedAt: string;
  text: string;
  photoUrl?: string;
  /** ISO-8601 */
  createdAt: string;
  source: RecordSource;
}

/** A short community review of any site. */
export interface SiteReview {
  id: string;
  siteId: string;
  author: string;
  text: string;
  /** ISO-8601 */
  createdAt: string;
  source: RecordSource;
}

/** One upvote. Kept per voter so a browser cannot vote twice. */
export interface SiteVote {
  siteId: string;
  voter: string;
  createdAt: string;
  source: RecordSource;
}

/**
 * Everything the community layer holds, in one payload.
 *
 * The backend exposes this at `GET {base}/community` (see services/api.ts), so
 * a shared deployment swaps the browser-only store for real collaboration
 * without any component changing.
 */
export interface CommunityState {
  reportedSites: ReportedSite[];
  notes: FieldNote[];
  reviews: SiteReview[];
  votes: SiteVote[];
}

/** One tracked orbital object, as prepared by Zehra. */
export interface OrbitalObject {
  id: string;
  name: string;
  noradId?: number;
  /** Two-line element set, if available. */
  tle?: {
    line1: string;
    line2: string;
  };
  altitudeKm?: number;
  inclinationDeg?: number;
  /** ISO-8601 epoch of the element set. */
  epoch?: string;
}
