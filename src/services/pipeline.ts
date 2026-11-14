/**
 * Read-through to the data pipeline's own outputs.
 *
 * Everything here is imported straight from the files the rest of the team
 * commits on `main`, so the shell renders what the pipeline actually produced
 * rather than a copy that can drift:
 *
 *   docs/dataset_catalog.csv   Abid's NASA dataset registry  -> DataSource[]
 *   reports/comparison_*.json  the TerraNexus engine verdicts -> EngineComparison[]
 *   data/samples/*_stats.json  measured terrain statistics    -> TerrainSample[]
 *
 * The files are imported with `?raw` / as JSON, so the bundler embeds them at
 * build time: no backend, no fetch, and a pipeline rerun shows up on the next
 * build. What the pipeline does **not** publish yet is a per-site analog score,
 * so `getPredictions()` still returns the contract fixtures; this module covers
 * the datasets, the engine evidence and the measured ground truth.
 */

import catalogCsv from '../../docs/dataset_catalog.csv?raw';
import lolaStats from '../../data/samples/lola_moon_stats.json';
import molaStats from '../../data/samples/mola_mars_stats.json';
import srtmStats from '../../data/samples/srtm_earth_stats.json';
import marsReport from '../../reports/comparison_results_earth_atacama_s24w069_vs_mars.json';
import moonReport from '../../reports/comparison_results_earth_atacama_s24w069_vs_moon.json';
import type { DataSource, FocusArea } from '../data-contracts/types';

/* ------------------------------------------------------------ CSV parsing ---- */

/**
 * A small RFC-4180 reader. The catalog quotes fields that contain commas — the
 * licence and processing notes do — so splitting on commas would sheaf those
 * rows into the wrong columns.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/* ------------------------------------------------------- dataset catalog ---- */

const [catalogHeader, ...catalogRows] = parseCsv(catalogCsv);

function catalogCell(row: string[], name: string): string {
  const index = catalogHeader.indexOf(name);
  return index >= 0 ? (row[index] ?? '').trim() : '';
}

/**
 * The catalog records which body a dataset observes, not which challenge focus
 * area it serves. An Earth dataset is what both analogues are measured with; a
 * Mars or Moon dataset serves its own side of the comparison.
 */
const FOCUS_BY_BODY: Record<string, FocusArea[]> = {
  earth: ['dual-analog'],
  mars: ['mars-base-analog'],
  moon: ['moon-base-analog'],
  generic: ['dual-analog'],
};

/** Abid's catalog, mapped onto the shell's DataSource contract. */
export const pipelineDatasets: DataSource[] = catalogRows
  .filter((row) => catalogCell(row, 'dataset_id') !== '')
  .map((row) => ({
    id: catalogCell(row, 'dataset_id'),
    name: catalogCell(row, 'dataset_name'),
    provider: catalogCell(row, 'source_agency'),
    instrument: catalogCell(row, 'mission_or_instrument') || undefined,
    url: catalogCell(row, 'official_landing_page'),
    focusAreas: FOCUS_BY_BODY[catalogCell(row, 'planetary_body').toLowerCase()] ?? ['dual-analog'],
    variables: catalogCell(row, 'parameter')
      .split(/[;,]/)
      .map((entry) => entry.trim())
      .filter(Boolean),
    temporalResolution: catalogCell(row, 'temporal_coverage') || undefined,
    spatialResolution: catalogCell(row, 'spatial_resolution') || undefined,
    retrievedAt: `${catalogCell(row, 'last_verified') || '2026-11-14'}T00:00:00.000Z`,
  }));

/* ------------------------------------------------------ engine verdicts ---- */

/** The shape of one TerraNexus comparison report, as the engine writes it. */
interface EngineReport {
  candidate_id: string;
  engine_version: string;
  framework: string;
  location: { name: string };
  planetary_context: { target_body: string; target_region: string };
  dimensions: Record<
    string,
    { status: string; similarities?: unknown[]; mismatches?: unknown[]; evidence?: unknown[] }
  >;
  data_quality: {
    candidate_resolution_m: number;
    target_resolution_m: number;
    candidate_valid_pct: number;
    target_valid_pct: number;
  };
  uncertainties: string[];
}

export interface EngineDimension {
  id: string;
  label: string;
  /** The engine's own verdict word, kept verbatim: DIFFERENT, QUALITATIVE_MATCH… */
  status: string;
  similar: number;
  mismatched: number;
  evidence: number;
}

export interface EngineComparison {
  target: 'moon' | 'mars';
  framework: string;
  engineVersion: string;
  candidate: string;
  targetRegion: string;
  dimensions: EngineDimension[];
  candidateResolutionM: number;
  targetResolutionM: number;
  uncertainties: string[];
}

const dimensionLabel = (id: string) => {
  const words = id.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

function summarise(report: EngineReport, target: 'moon' | 'mars'): EngineComparison {
  return {
    target,
    framework: report.framework,
    engineVersion: report.engine_version,
    candidate: report.location.name,
    targetRegion: report.planetary_context.target_region,
    candidateResolutionM: report.data_quality.candidate_resolution_m,
    targetResolutionM: report.data_quality.target_resolution_m,
    uncertainties: report.uncertainties,
    dimensions: Object.entries(report.dimensions).map(([id, dimension]) => ({
      id,
      label: dimensionLabel(id),
      status: dimension.status,
      similar: dimension.similarities?.length ?? 0,
      mismatched: dimension.mismatches?.length ?? 0,
      evidence: dimension.evidence?.length ?? 0,
    })),
  };
}

/** The engine's verdicts for the one Earth candidate it has been run on. */
export const engineComparisons: EngineComparison[] = [
  summarise(marsReport as unknown as EngineReport, 'mars'),
  summarise(moonReport as unknown as EngineReport, 'moon'),
];

/* --------------------------------------------------- measured terrain ---- */

interface RawStats {
  dataset_id: string;
  planet: string;
  region: string;
  data_type: string;
  bbox: number[];
  grid_resolution_deg?: number;
  grid_resolution_m?: string;
  elevation_m: { min: number; max: number; mean: number; std?: number };
  slope_deg: { min: number; max: number; mean: number };
  roughness_tri_m: { min: number; max: number; mean: number };
  sample_rows: number;
  source_citation: string;
}

export interface TerrainSample {
  datasetId: string;
  planet: 'earth' | 'mars' | 'moon';
  region: string;
  /** The pipeline tags each sample as real measurement or synthetic. */
  dataType: string;
  rows: number;
  elevationMeanM: number;
  /** One standard deviation, where the sample publishes one. */
  elevationStdM?: number;
  slopeMeanDeg: number;
  slopeMinDeg: number;
  /** Steepest cell in the grid: what stops a traverse, not what averages out. */
  slopeMaxDeg: number;
  roughnessMeanM: number;
  roughnessMinM: number;
  roughnessMaxM: number;
  citation: string;
}

const toSample = (raw: RawStats): TerrainSample => ({
  datasetId: raw.dataset_id,
  planet: raw.planet as TerrainSample['planet'],
  region: raw.region,
  dataType: raw.data_type,
  rows: raw.sample_rows,
  elevationMeanM: raw.elevation_m.mean,
  elevationStdM: raw.elevation_m.std,
  slopeMeanDeg: raw.slope_deg.mean,
  slopeMinDeg: raw.slope_deg.min,
  slopeMaxDeg: raw.slope_deg.max,
  roughnessMeanM: raw.roughness_tri_m.mean,
  roughnessMinM: raw.roughness_tri_m.min,
  roughnessMaxM: raw.roughness_tri_m.max,
  citation: raw.source_citation,
});

/** Real measurements the sample builder produced, one row per body. */
export const measuredTerrain: TerrainSample[] = [
  toSample(srtmStats as unknown as RawStats),
  toSample(molaStats as unknown as RawStats),
  toSample(lolaStats as unknown as RawStats),
];
