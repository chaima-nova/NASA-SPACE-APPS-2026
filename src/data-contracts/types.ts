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
  /** Optional secondary fit for Mars base sites specifically, [0, 1]. */
  marsFit?: number;
  /** Human-readable bucket, e.g. "Strong" / "Promising" / "Weak". */
  label: string;
  /** Model confidence in [0, 1]. */
  confidence: number;
  /** Feature name -> signed contribution to the score. */
  featureContributions: Record<string, number>;
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
