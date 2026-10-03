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
 * If the backend field names change, update ONLY this file + src/services/api.ts.
 */

export type FocusArea =
  | 'urban-heat-equity'
  | 'atmospheric-environmental-health'
  | 'space-systems';

/** One NASA dataset, as catalogued by Abid. */
export interface DataSource {
  id: string;
  name: string;
  /** e.g. "NASA" / "NASA POWER" / "NASA Earthdata" */
  provider: string;
  /** e.g. "MODIS", "Landsat 9 OLI", "Sentinel-5P TROPOMI" */
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

/** A geospatial sample point / feature vector prepared by Farwa. */
export interface GeoPoint {
  id: string;
  lat: number;
  lon: number;
  focusArea: FocusArea;
  /** Named geospatial features. Numbers only so Harshil can train directly. */
  features: Record<string, number>;
}

/** One ML inference result produced by Harshil's pipeline. */
export interface Prediction {
  id: string;
  /** Links back to the GeoPoint this prediction covers. */
  pointId: string;
  lat: number;
  lon: number;
  focusArea: FocusArea;
  model: {
    id: string;
    version: string;
  };
  /** ISO-8601 */
  predictedAt: string;
  /** Primary score in [0, 1]. Higher = more at-risk. */
  heatRisk: number;
  /** Optional secondary target for the atmospheric focus area, [0, 1]. */
  airQualityRisk?: number;
  /** Human-readable bucket, e.g. "High" / "Moderate" / "Low". */
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
