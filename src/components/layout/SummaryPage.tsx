import { Panel } from './Panel';
import { scoreColor } from '../../lib/colors';
import { formatScore, TERRAIN_LABELS, terrainOf } from '../../lib/site';
import { engineComparisons, measuredTerrain, pipelineDatasets } from '../../services/pipeline';
import type { Prediction, TerrainType } from '../../data-contracts/types';
import { SCORE_BANDS } from '../../data-contracts/types';

interface SummaryPageProps {
  /** Every scored site the app holds. */
  predictions: Prediction[];
  /** How many NASA datasets the pipeline catalogued. */
  datasetCount: number;
}

const BODY_LABELS: Record<string, string> = {
  earth: 'Earth',
  mars: 'Mars',
  moon: 'Moon',
};

/** Bucket edges for the analog-fit histogram. */
const BUCKETS = Array.from({ length: 10 }, (_, index) => ({
  label: String(index * 10),
  mid: (index + 0.5) / 10,
  count: 0,
}));

/**
 * Fit Summary: the whole dataset, as shapes.
 *
 * A separate tab because the workbench is for comparing one site at a time and
 * these numbers are about the collection — how the scores distribute, which
 * terrain families carry the list, and what the measured samples actually say.
 * Deliberately short on prose: each block is a figure with a four-word caption,
 * and the only sentences are the ones that stop a reader misreading a bar.
 */
export function SummaryPage({ predictions, datasetCount }: SummaryPageProps) {
  // One pass over the scores; the histogram is the only consumer.
  const buckets = BUCKETS.map((bucket) => ({ ...bucket }));
  for (const prediction of predictions) {
    const index = Math.min(9, Math.max(0, Math.floor(prediction.analogScore * 10)));
    buckets[index].count += 1;
  }
  const tallest = Math.max(1, ...buckets.map((bucket) => bucket.count));

  const meanFit =
    predictions.length === 0
      ? 0
      : predictions.reduce((total, prediction) => total + prediction.analogScore, 0) /
        predictions.length;
  const strong = predictions.filter(
    (prediction) => prediction.analogScore >= SCORE_BANDS.strong,
  ).length;

  const familyCounts = new Map<TerrainType, number>();
  for (const prediction of predictions) {
    const family = terrainOf(prediction);
    if (family) familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
  }
  const families = [...familyCounts.entries()].sort((a, b) => b[1] - a[1]);
  const busiestFamily = Math.max(1, ...families.map(([, count]) => count));

  // Slope is the one terrain statistic every sample carries a full range for,
  // so its whisker is drawn rather than described.
  const steepest = Math.max(1, ...measuredTerrain.map((sample) => sample.slopeMaxDeg));

  const checks = engineComparisons.reduce(
    (total, comparison) => total + comparison.dimensions.length,
    0,
  );
  const insufficient = engineComparisons
    .flatMap((comparison) => comparison.dimensions)
    .filter((dimension) => dimension.status === 'INSUFFICIENT_EVIDENCE').length;

  return (
    <main className="summary-page">
      <header className="summary-head">
        <p className="summary-kicker">Fit summary</p>
        <h2>The collection at a glance</h2>
        <p className="summary-lede">
          Every site this build holds, and every measurement the pipeline published for it.
        </p>
      </header>

      <div className="summary-tiles">
        <div className="summary-tile">
          <b>{predictions.length}</b>
          <span>Sites scored</span>
        </div>
        <div className="summary-tile">
          <b>{formatScore(meanFit)}</b>
          <span>Mean analog fit</span>
        </div>
        <div className="summary-tile">
          <b>{strong}</b>
          <span>Strong fits</span>
        </div>
        <div className="summary-tile">
          <b>{datasetCount}</b>
          <span>Datasets</span>
        </div>
      </div>

      <div className="summary-grid">
        <Panel
          title="Fit distribution"
          subtitle="Sites per analog-fit bucket"
          className="summary-wide"
        >
          <div className="summary-histogram" role="img" aria-label={`Fit distribution over ${predictions.length} sites`}>
            {buckets.map((bucket) => (
              <div
                key={bucket.label}
                className="summary-histogram-column"
                title={`${bucket.count} site${bucket.count === 1 ? '' : 's'} at ${bucket.label}–${
                  Number(bucket.label) + 10
                }%`}
              >
                <span className="summary-histogram-count">{bucket.count || ''}</span>
                <span
                  className="summary-histogram-bar"
                  style={{
                    height: `${
                      bucket.count === 0 ? 3 : Math.max(6, (bucket.count / tallest) * 140)
                    }px`,
                    background: bucket.count === 0 ? 'var(--line)' : scoreColor(bucket.mid),
                  }}
                />
                <span className="summary-histogram-label">{bucket.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Terrain mix" subtitle="Sites by family">
          {families.length === 0 ? (
            <p className="summary-empty">No classified sites in this build.</p>
          ) : (
            <ul className="summary-bars">
              {families.map(([family, count]) => (
                <li key={family}>
                  <span className="summary-bars-label">{TERRAIN_LABELS[family]}</span>
                  <span className="summary-bars-track">
                    <span
                      style={{
                        width: `${(count / busiestFamily) * 100}%`,
                        background: scoreColor(count / busiestFamily),
                      }}
                    />
                  </span>
                  <b>{count}</b>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Measured slope" subtitle="Mean and measured range">
          <ul className="summary-ranges">
            {measuredTerrain.map((sample) => (
              <li key={sample.datasetId}>
                <span className="summary-ranges-label">{BODY_LABELS[sample.planet] ?? sample.planet}</span>
                <span className="summary-ranges-track">
                  <span
                    className="summary-ranges-span"
                    style={{
                      left: `${(sample.slopeMinDeg / steepest) * 100}%`,
                      width: `${((sample.slopeMaxDeg - sample.slopeMinDeg) / steepest) * 100}%`,
                    }}
                  />
                  <span
                    className="summary-ranges-dot"
                    style={{ left: `${(sample.slopeMeanDeg / steepest) * 100}%` }}
                  />
                </span>
                <b>{sample.slopeMeanDeg.toFixed(2)}°</b>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Evidence depth" subtitle="Engine checks that had data">
          <div className="summary-depth">
            <span className="summary-depth-ring">
              <b>{checks - insufficient}</b>
              <span>of {checks}</span>
            </span>
            <p className="summary-depth-note">
              {insufficient} check{insufficient === 1 ? '' : 's'} returned insufficient evidence,
              so {pipelineDatasets.length} datasets cover the surface but not the rest.
            </p>
          </div>
        </Panel>
      </div>
    </main>
  );
}
