import { engineComparisons, measuredTerrain } from '../../services/pipeline';

/**
 * What the TerraNexus engine and the sample builder actually reported.
 *
 * The library above is the catalogue; this is the evidence underneath it — the
 * engine's per-dimension verdicts for the one Earth candidate it has been run
 * on, and the measured statistics of the samples each body's data produced.
 * Values are quoted straight from `reports/` and `data/samples/`; where the
 * engine says INSUFFICIENT_EVIDENCE the panel says so rather than rounding it
 * into a score.
 */

const STATUS_LABELS: Record<string, string> = {
  DIFFERENT: 'Different',
  SIMILAR: 'Similar',
  QUALITATIVE_MATCH: 'Qualitative match',
  INSUFFICIENT_EVIDENCE: 'Insufficient evidence',
  NOT_COMPARABLE: 'Not comparable',
};

const statusLabel = (status: string) => STATUS_LABELS[status] ?? status;

const statusClass = (status: string) =>
  status === 'SIMILAR' || status === 'QUALITATIVE_MATCH'
    ? 'is-match'
    : status === 'DIFFERENT'
      ? 'is-different'
      : 'is-thin';

const PLANET_LABELS: Record<string, string> = {
  earth: 'Earth',
  mars: 'Mars',
  moon: 'Moon',
};

export function PipelineEvidence() {
  const { framework, engineVersion } = engineComparisons[0];

  return (
    <div className="pipeline-evidence">
      <p className="pipeline-kicker">
        {framework} engine · v{engineVersion} · verdicts below come from the team's comparison
        reports, not from this interface.
      </p>

      {engineComparisons.map((comparison) => (
        <article key={comparison.target} className="pipeline-case">
          <h4>
            {comparison.candidate} → {comparison.targetRegion}
          </h4>
          <p className="pipeline-meta">
            {comparison.candidateResolutionM} m/px candidate vs {comparison.targetResolutionM} m/px
            target · resolution is the dominant uncertainty
          </p>
          <ul className="pipeline-dimensions">
            {comparison.dimensions.map((dimension) => (
              <li key={dimension.id} className={statusClass(dimension.status)}>
                <span className="pipeline-dimension-name">{dimension.label}</span>
                <span className="pipeline-dimension-status">{statusLabel(dimension.status)}</span>
                {dimension.similar + dimension.mismatched + dimension.evidence > 0 ? (
                  <span className="pipeline-dimension-count">
                    {dimension.similar} similar · {dimension.mismatched} differing ·{' '}
                    {dimension.evidence} notes
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </article>
      ))}

      <table className="pipeline-terrain">
        <caption>Measured samples from the pipeline</caption>
        <thead>
          <tr>
            <th scope="col">Body</th>
            <th scope="col">Region</th>
            <th scope="col">Rows</th>
            <th scope="col">Mean elevation</th>
            <th scope="col">Mean slope</th>
            <th scope="col">Mean roughness</th>
          </tr>
        </thead>
        <tbody>
          {measuredTerrain.map((sample) => (
            <tr key={sample.datasetId}>
              <td>{PLANET_LABELS[sample.planet] ?? sample.planet}</td>
              <td>{sample.region}</td>
              <td>{sample.rows.toLocaleString('en-US')}</td>
              <td>{Math.round(sample.elevationMeanM).toLocaleString('en-US')} m</td>
              <td>{sample.slopeMeanDeg.toFixed(2)}°</td>
              <td>{sample.roughnessMeanM.toFixed(1)} m</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
