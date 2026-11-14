import { formatScore } from '../../lib/site';

/**
 * The comparison as a shape rather than a table.
 *
 * One axis per scientific dimension, plus both fits and the model's own
 * confidence, drawn as one polygon per site, so the question "which of
 * these two is better, and on what" is answered by the silhouette before any
 * number is read. Values are [0, 1] and are printed beside each axis, so the
 * chart is a summary and not the only record.
 *
 * Hand-drawn SVG rather than a chart library: the dialog already owns its own
 * typography and palette, and this needs no tooltip layer to be readable.
 */

/** One measured axis of the comparison. */
export interface RadarAxis {
  id: string;
  label: string;
}

/** One site's values, in the same order as the axes. */
export interface RadarSeries {
  label: string;
  color: string;
  values: number[];
}

interface AnalogueRadarProps {
  axes: RadarAxis[];
  /** The site already open in the dossier. */
  current: RadarSeries;
  /** The site it is being compared against. */
  other: RadarSeries;
}

const WIDTH = 460;
const HEIGHT = 360;
const CX = WIDTH / 2;
const CY = 184;
const R = 112;
const RINGS = [0.25, 0.5, 0.75, 1];

const angleAt = (index: number, count: number) => -Math.PI / 2 + (index * 2 * Math.PI) / count;

const clamp = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);

/** Where a value sits on one axis. */
function vertex(index: number, count: number, value: number): [number, number] {
  const angle = angleAt(index, count);
  const radius = R * clamp(value);
  return [CX + Math.cos(angle) * radius, CY + Math.sin(angle) * radius];
}

/** The polygon string for one site. */
const shape = (values: number[]) =>
  values.map((value, index) => vertex(index, values.length, value).join(',')).join(' ');

export function AnalogueRadar({ axes, current, other }: AnalogueRadarProps) {
  const count = axes.length;

  // Spoken form: a radar is one image to a sighted reader and seven numbers to
  // a listener, so the label carries them all rather than a summary.
  const spoken = axes
    .map(
      (axis, index) =>
        `${axis.label}: ${current.label} ${formatScore(
          current.values[index],
        )}, ${other.label} ${formatScore(other.values[index])}`,
    )
    .join('. ');

  return (
    <figure className="radar">
      <svg
        className="radar-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Comparison radar over ${count} axes. ${spoken}.`}
      >
        {RINGS.map((ring) => (
          <polygon
            key={ring}
            className={ring === 1 ? 'radar-ring is-outer' : 'radar-ring'}
            points={shape(axes.map(() => ring))}
          />
        ))}

        {axes.map((axis, index) => {
          const [x, y] = vertex(index, count, 1);
          return <line key={axis.id} className="radar-spoke" x1={CX} y1={CY} x2={x} y2={y} />;
        })}

        {/* Compared site first, current site on top: the reader is looking at
            the current one, so it should never be hidden behind the other. */}
        {[other, current].map((series) => (
          <g key={series.label}>
            <polygon points={shape(series.values)} fill={series.color} fillOpacity={0.16} />
            <polygon
              points={shape(series.values)}
              fill="none"
              stroke={series.color}
              strokeWidth={1.7}
              strokeLinejoin="round"
              style={{ filter: `drop-shadow(0 0 5px ${series.color}55)` }}
            />
            {series.values.map((value, index) => {
              const [x, y] = vertex(index, count, value);
              return <circle key={index} cx={x} cy={y} r={2.6} fill={series.color} />;
            })}
          </g>
        ))}

        {axes.map((axis, index) => {
          const angle = angleAt(index, count);
          const x = CX + Math.cos(angle) * (R + 22);
          const y = CY + Math.sin(angle) * (R + 22);
          const horizontal = Math.cos(angle);
          const align: 'start' | 'middle' | 'end' =
            Math.abs(horizontal) < 0.2 ? 'middle' : horizontal > 0 ? 'start' : 'end';
          return (
            <g key={axis.id}>
              <text x={x} y={y} textAnchor={align} className="radar-axis">
                {axis.label}
              </text>
              <text x={x} y={y + 11} textAnchor={align} className="radar-values">
                {formatScore(current.values[index])} · {formatScore(other.values[index])}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className="radar-legend">
        {[current, other].map((series) => (
          <span key={series.label} className="radar-key">
            <span
              className="radar-swatch"
              style={{ background: series.color }}
              aria-hidden="true"
            />
            {series.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
