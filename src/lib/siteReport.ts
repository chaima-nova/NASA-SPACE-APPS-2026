/**
 * The per-site export: one site, in depth.
 *
 * The ranking export answers "which sites, in what order". This answers the
 * question a reader actually opens the dossier for: why does this place score
 * the way it does, and where does the analogy break down. Both the workbook and
 * the standalone page are built from the same tables here, so the numbers in
 * the HTML and in the spreadsheet cannot drift apart.
 *
 * Every comparison is derived from data the app already holds — the four
 * pillars, the feature contributions and the physical conditions of the target
 * body. Nothing is invented for a site the model has not scored.
 */

import type { Prediction } from '../data-contracts/types';
import type { Table } from './export';
import {
  FACTOR_HINTS,
  FACTOR_LABELS,
  FACTOR_ORDER,
  TARGET_LABELS,
  factorsOf,
  fitFor,
  formatCoords,
  formatElevation,
  targetSiteOf,
  terrainLabel,
  verdictOf,
  type SiteFactors,
  type Target,
} from './site';

/** One place the Earth analogue stops behaving like the target body. */
export interface Mismatch {
  aspect: string;
  /** What this site scores on the pillar, [0, 1]. */
  analogue: number;
  /** What a permanent base on the target body demands, [0, 1]. */
  required: number;
  gap: number;
  detail: string;
}

interface TargetProfile {
  /** Physical conditions, shown as facts rather than as scores. */
  gravityG: number;
  pressureKPa: number;
  dayLength: string;
  diurnalSwingC: number;
  radiation: string;
  /** The pillar levels a permanent base on this body actually needs. */
  demand: SiteFactors;
}

const PROFILES: Record<Target, TargetProfile> = {
  moon: {
    gravityG: 0.165,
    pressureKPa: 0,
    dayLength: '29.5 Earth days',
    diurnalSwingC: 280,
    radiation:
      'No atmosphere and no global magnetic field, so the full solar and galactic cosmic ray flux reaches the ground.',
    demand: { geomorphology: 0.8, mineralogy: 0.85, environment: 0.95, logistics: 0.45 },
  },
  mars: {
    gravityG: 0.379,
    pressureKPa: 0.61,
    dayLength: '24 h 37 min',
    diurnalSwingC: 80,
    radiation:
      'A CO2 atmosphere at 0.6% of Earth pressure and no global field: surface dose is many times the terrestrial level.',
    demand: { geomorphology: 0.7, mineralogy: 0.75, environment: 0.8, logistics: 0.4 },
  },
};

/**
 * Pillars where this site falls short of what the target body demands, worst
 * first. A shortfall is what a mission planner has to engineer around, so those
 * rows lead; a pillar that meets demand is not listed as a mismatch.
 */
export function mismatchesOf(prediction: Prediction, target: Target): Mismatch[] {
  const factors = factorsOf(prediction);
  const demand = PROFILES[target].demand;

  return FACTOR_ORDER.map((key) => ({
    aspect: FACTOR_LABELS[key],
    analogue: factors[key],
    required: demand[key],
    gap: Math.max(0, demand[key] - factors[key]),
    detail: FACTOR_HINTS[key],
  }))
    .filter((row) => row.gap > 0.01)
    .sort((a, b) => b.gap - a.gap);
}

/** One sentence naming the biggest gap, for the top of the page. */
function shortfallSentence(rows: Mismatch[], target: Target): string {
  if (rows.length === 0) {
    return `This site meets the modelled demand on every pillar for ${TARGET_LABELS[target]}, so the remaining differences are physical rather than terrain.`;
  }
  const worst = rows[0];
  const others = rows
    .slice(1)
    .map((row) => row.aspect.toLowerCase())
    .join(' and ');
  const tail = others ? `, and also on ${others}` : '';
  return `The analogy is weakest on ${worst.aspect.toLowerCase()} — ${Math.round(
    worst.analogue * 100,
  )}% against the ${Math.round(worst.required * 100)}% a ${TARGET_LABELS[target]} base needs${tail}.`;
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const pct = (value: number) => `${Math.round(value * 100)}%`;

/** A horizontal bar with a tick at the level the target body demands. */
function pillarBar(label: string, value: number, required: number, hint: string): string {
  return `        <figure class="bar">
          <figcaption><span>${escapeXml(label)}</span><b>${pct(value)}</b></figcaption>
          <div class="track" role="img" aria-label="${escapeXml(label)} ${pct(value)} of a required ${pct(required)}">
            <span class="fill" style="width:${(value * 100).toFixed(1)}%"></span>
            <span class="mark" style="left:${(required * 100).toFixed(1)}%"></span>
          </div>
          <p class="hint">${escapeXml(hint)}</p>
        </figure>`;
}

/** The analog-fit score as a ring, so the headline number reads at a glance. */
function scoreRing(score: number, label: string): string {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * Math.min(1, Math.max(0, score));
  return `      <svg class="ring" viewBox="0 0 140 140" role="img" aria-label="Analog fit ${pct(score)}, ${escapeXml(label)}">
        <circle cx="70" cy="70" r="${radius}" class="ring-track" />
        <circle cx="70" cy="70" r="${radius}" class="ring-fill"
          stroke-dasharray="${dash.toFixed(1)} ${circumference.toFixed(1)}"
          transform="rotate(-90 70 70)" />
        <text x="70" y="66" class="ring-value">${pct(score)}</text>
        <text x="70" y="88" class="ring-label">${escapeXml(label)}</text>
      </svg>`;
}

/** Signed feature contributions, largest first — what moved the score. */
function contributionBars(contributions: Record<string, number>): string {
  const rows = Object.entries(contributions).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const ceiling = Math.max(...rows.map(([, value]) => Math.abs(value)), 0.0001);

  return rows
    .map(
      ([key, value]) => `        <div class="contrib">
          <span class="contrib-name">${escapeXml(key)}</span>
          <span class="contrib-track"><span class="contrib-fill" style="width:${(
            (Math.abs(value) / ceiling) *
            100
          ).toFixed(1)}%"></span></span>
          <span class="contrib-value">${value.toFixed(3)}</span>
        </div>`,
    )
    .join('\n');
}

/** A table row per metric: the value, the target's demand, and the gap. */
function detailTable(prediction: Prediction, target: Target): Table {
  const profile = PROFILES[target];
  const factors = factorsOf(prediction);
  const mismatch = mismatchesOf(prediction, target);
  const body = targetSiteOf(prediction, target);

  const rows: string[][] = [
    ['identity', 'Site', prediction.siteName, '—', '—', '—'],
    ['identity', 'Region', prediction.region ?? '—', '—', '—', '—'],
    ['identity', 'Terrain', terrainLabel(prediction), '—', '—', '—'],
    ['identity', 'Coordinates', formatCoords(prediction.lat, prediction.lon), '—', '—', '—'],
    ['identity', 'Elevation', formatElevation(prediction.elevationM), '—', '—', '—'],
    ['identity', 'Comparison target', TARGET_LABELS[target], '—', '—', '—'],
    [
      'identity',
      'Target-body location',
      body ? `${body.name} (${formatCoords(body.lat, body.lon)})` : 'not crosswalked',
      '—',
      '—',
      '—',
    ],
    [
      'score',
      `Analog fit (${TARGET_LABELS[target]})`,
      fitFor(prediction, target).toFixed(3),
      '—',
      '—',
      prediction.label,
    ],
    ['score', 'Moon fit', fitFor(prediction, 'moon').toFixed(3), '—', '—', '—'],
    ['score', 'Mars fit', fitFor(prediction, 'mars').toFixed(3), '—', '—', '—'],
    ['score', 'Model confidence', prediction.confidence.toFixed(2), '—', '—', '—'],
    ['score', 'Verdict', verdictOf(prediction, target), '—', '—', '—'],
    ...FACTOR_ORDER.map((key) => [
      'pillar',
      FACTOR_LABELS[key],
      factors[key].toFixed(3),
      profile.demand[key].toFixed(3),
      Math.max(0, profile.demand[key] - factors[key]).toFixed(3),
      FACTOR_HINTS[key],
    ]),
    ...mismatch.map((row) => [
      'mismatch',
      row.aspect,
      row.analogue.toFixed(3),
      row.required.toFixed(3),
      row.gap.toFixed(3),
      row.detail,
    ]),
    ['condition', 'Surface gravity', '1.00 g', `${profile.gravityG.toFixed(3)} g`, '—', 'Cannot be simulated terrestrially.'],
    [
      'condition',
      'Surface pressure',
      '101.3 kPa',
      profile.pressureKPa === 0 ? 'vacuum' : `${profile.pressureKPa} kPa`,
      '—',
      'Vacuum or near-vacuum: no convective cooling, no airborne dust settling.',
    ],
    [
      'condition',
      'Day length',
      '24 h',
      profile.dayLength,
      '—',
      'Drives the thermal cycle and the power budget.',
    ],
    [
      'condition',
      'Diurnal swing',
      `${Math.round(factorsOf(prediction).environment * 100)}% matched`,
      `${profile.diurnalSwingC} °C`,
      '—',
      'Environment pillar, measured against the target body.',
    ],
    ['condition', 'Radiation environment', 'shielded', 'unshielded', '—', profile.radiation],
    ...Object.entries(prediction.featureContributions).map(([key, value]) => [
      'feature',
      key,
      value.toFixed(3),
      '—',
      '—',
      'Contribution to the analog-fit score.',
    ]),
  ];

  return {
    header: ['section', 'metric', 'value', 'target_demand', 'gap', 'note'],
    rows,
  };
}

function reportHtml(prediction: Prediction, target: Target): string {
  const profile = PROFILES[target];
  const factors = factorsOf(prediction);
  const mismatch = mismatchesOf(prediction, target);
  const body = targetSiteOf(prediction, target);
  const score = fitFor(prediction, target);
  const title = `${prediction.siteName} — ${TARGET_LABELS[target]} analogue analysis`;

  const pillarRows = FACTOR_ORDER.map((key) =>
    pillarBar(FACTOR_LABELS[key], factors[key], profile.demand[key], FACTOR_HINTS[key]),
  ).join('\n');

  const mismatchRows = mismatch
    .map(
      (row) => `        <tr>
          <th scope="row">${escapeXml(row.aspect)}</th>
          <td>${pct(row.analogue)}</td>
          <td>${pct(row.required)}</td>
          <td class="gap">−${pct(row.gap)}</td>
          <td>${escapeXml(row.detail)}</td>
        </tr>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeXml(title)}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 36px;
        font: 14px/1.55 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
        color: #16202c;
        background: #ffffff;
      }
      h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: -0.015em; }
      h2 { margin: 30px 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #5b6b7c; }
      .meta { margin: 0 0 22px; font-size: 12px; color: #5b6b7c; }
      .lede { font-size: 14px; max-width: 74ch; }
      .headline { display: flex; gap: 28px; align-items: center; flex-wrap: wrap; }
      .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 0; flex: 1; }
      .facts div { border: 1px solid #dbe2ea; border-radius: 6px; padding: 8px 10px; }
      .facts dt { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #5b6b7c; }
      .facts dd { margin: 2px 0 0; font-size: 13px; font-variant-numeric: tabular-nums; }
      .ring { width: 140px; height: 140px; flex: none; }
      .ring-track { fill: none; stroke: #e6ecf2; stroke-width: 12; }
      .ring-fill { fill: none; stroke: #0f766e; stroke-width: 12; stroke-linecap: round; }
      .ring-value { text-anchor: middle; font-size: 26px; font-weight: 650; fill: #16202c; }
      .ring-label { text-anchor: middle; font-size: 10px; fill: #5b6b7c; text-transform: uppercase; letter-spacing: 0.05em; }
      .bars { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px 24px; }
      .bar { margin: 0; }
      .bar figcaption { display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 5px; }
      .bar figcaption b { font-variant-numeric: tabular-nums; }
      .track { position: relative; height: 9px; border-radius: 5px; background: #e6ecf2; overflow: hidden; }
      .fill { position: absolute; inset: 0 auto 0 0; border-radius: 5px; background: #0f766e; }
      .mark { position: absolute; top: -3px; width: 2px; height: 15px; background: #b45309; }
      .hint { margin: 5px 0 0; font-size: 11px; color: #5b6b7c; }
      table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
      th, td { padding: 7px 10px; border-bottom: 1px solid #dbe2ea; text-align: left; vertical-align: top; }
      thead th { background: #eef2f6; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; }
      td.gap { color: #b42318; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .contrib { display: grid; grid-template-columns: 150px 1fr 60px; gap: 10px; align-items: center; margin-bottom: 5px; font-size: 12px; }
      .contrib-name { color: #33475b; }
      .contrib-track { height: 7px; border-radius: 4px; background: #e6ecf2; overflow: hidden; }
      .contrib-fill { display: block; height: 100%; background: #33475b; }
      .contrib-value { text-align: right; font-variant-numeric: tabular-nums; color: #5b6b7c; }
      footer { margin-top: 34px; font-size: 11px; color: #5b6b7c; border-top: 1px solid #dbe2ea; padding-top: 12px; }
      @media print { body { padding: 0; } h2 { page-break-after: avoid; } table { page-break-inside: auto; } }
    </style>
  </head>
  <body>
    <h1>${escapeXml(prediction.siteName)}</h1>
    <p class="meta">
      ${escapeXml(terrainLabel(prediction))} terrain · ${escapeXml(formatCoords(prediction.lat, prediction.lon))}
      · ${escapeXml(formatElevation(prediction.elevationM))} · compared against ${escapeXml(TARGET_LABELS[target])}
      · exported ${new Date().toISOString().slice(0, 10)}
    </p>

    <div class="headline">
${scoreRing(score, `${TARGET_LABELS[target]} fit`)}
      <dl class="facts">
        <div><dt>Analog fit</dt><dd>${score.toFixed(3)} · ${escapeXml(prediction.label)}</dd></div>
        <div><dt>Confidence</dt><dd>${prediction.confidence.toFixed(2)}</dd></div>
        <div><dt>Moon fit</dt><dd>${fitFor(prediction, 'moon').toFixed(3)}</dd></div>
        <div><dt>Mars fit</dt><dd>${fitFor(prediction, 'mars').toFixed(3)}</dd></div>
        <div><dt>Target ground</dt><dd>${
          body ? escapeXml(body.name) : 'not crosswalked'
        }</dd></div>
        <div><dt>Target coords</dt><dd>${body ? escapeXml(formatCoords(body.lat, body.lon)) : '—'}</dd></div>
      </dl>
    </div>

    <p class="lede">${escapeXml(verdictOf(prediction, target))} ${escapeXml(
      shortfallSentence(mismatch, target),
    )}</p>

    <h2>Four pillars against ${escapeXml(TARGET_LABELS[target])}</h2>
    <div class="bars">
${pillarRows}
    </div>
    <p class="hint">The orange tick is what a permanent base on ${escapeXml(
      TARGET_LABELS[target],
    )} demands; the bar is what this site provides.</p>

    <h2>What this analogue does not match</h2>
    <table>
      <thead>
        <tr><th scope="col">Pillar</th><th scope="col">Site</th><th scope="col">Required</th><th scope="col">Gap</th><th scope="col">Why it matters</th></tr>
      </thead>
      <tbody>
${mismatchRows || '        <tr><td colspan="5">No modelled pillar falls short of demand.</td></tr>'}
      </tbody>
    </table>

    <h2>Physical differences no terrestrial site can close</h2>
    <table>
      <thead>
        <tr><th scope="col">Condition</th><th scope="col">Earth</th><th scope="col">${escapeXml(
          TARGET_LABELS[target],
        )}</th><th scope="col">Note</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row">Surface gravity</th><td>1.00 g</td><td>${profile.gravityG.toFixed(
          3,
        )} g</td><td>${pct(profile.gravityG)} of Earth's; dust and slope behaviour differ accordingly.</td></tr>
        <tr><th scope="row">Surface pressure</th><td>101.3 kPa</td><td>${
          profile.pressureKPa === 0 ? 'vacuum' : `${profile.pressureKPa} kPa`
        }</td><td>No convection, no weather as this site experiences it.</td></tr>
        <tr><th scope="row">Day length</th><td>24 h</td><td>${escapeXml(
          profile.dayLength,
        )}</td><td>Sets the thermal cycle the base must ride out.</td></tr>
        <tr><th scope="row">Diurnal swing</th><td>moderated by air</td><td>${
          profile.diurnalSwingC
        } °C</td><td>${escapeXml(profile.radiation)}</td></tr>
      </tbody>
    </table>

    <h2>What drove the score</h2>
${contributionBars(prediction.featureContributions)}

    <footer>
      Scores are model estimates, not measurements. Coordinates are real analog sites; feature values
      are the sample inputs the shell was built against. Model ${escapeXml(
        prediction.model.id,
      )} ${escapeXml(prediction.model.version)}.
    </footer>
  </body>
</html>
`;
}

const slug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export interface SiteReport {
  title: string;
  filename: string;
  subtitle: string;
  /** Workbook and clipboard payload: one row per metric. */
  table: Table;
  /** Standalone page with the charts. */
  html: string;
}

/** Everything the export dialog needs for one site, on the active target. */
export function siteReport(prediction: Prediction, target: Target): SiteReport {
  const mismatch = mismatchesOf(prediction, target);
  const worst = mismatch[0];
  return {
    title: `${prediction.siteName} · ${TARGET_LABELS[target]} analysis`,
    filename: `site-analysis-${slug(prediction.siteName)}-${target}`,
    subtitle: worst
      ? `${verdictOf(prediction, target)} Weakest pillar: ${worst.aspect.toLowerCase()} (${Math.round(
          worst.gap * 100,
        )}% below what ${TARGET_LABELS[target]} demands).`
      : `${verdictOf(prediction, target)} No modelled pillar falls short of ${TARGET_LABELS[target]} demand.`,
    table: detailTable(prediction, target),
    html: reportHtml(prediction, target),
  };
}
