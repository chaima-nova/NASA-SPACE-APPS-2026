/**
 * The per-site export: one site, in depth.
 *
 * The ranking export answers "which sites, in what order". This answers the
 * question a reader actually opens the dossier for: what has been decided about
 * this place on each dimension, on what measurement, and where the analogy breaks
 * down. Both the workbook and the standalone page are built from the same tables
 * here, so the words in the HTML and in the spreadsheet cannot drift apart.
 *
 * Everything is derived from the classification (lib/classification.ts) and the
 * four universal limitations. There is no fit column, no confidence and no
 * weighted basket of dimensions: those went when the composite score did.
 */

import type { Prediction } from '../data-contracts/types';
import type { Table } from './export';
import {
  classificationSummary,
  classifySite,
  STATE_LABELS,
  STATE_MEANINGS,
  type DimensionVerdict,
} from './classification';
import {
  formatCoords,
  formatElevation,
  TARGET_LABELS,
  targetSiteOf,
  terrainLabel,
  type Target,
} from './site';

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** A table row per metric: the value, the target's demand, and the gap. */
function detailTable(prediction: Prediction, target: Target): Table {
  const classification = classifySite(prediction, target);
  const body = targetSiteOf(prediction, target);

  const rows: string[][] = [
    ['identity', 'Site', prediction.siteName, '—', '—', '—'],
    ['identity', 'Region', prediction.region ?? '—', '—', '—', '—'],
    ['identity', 'Terrain', terrainLabel(prediction), '—', '—', '—'],
    ['identity', 'Coordinates', formatCoords(prediction.lat, prediction.lon), '—', '—', '—'],
    ['identity', 'Elevation', formatElevation(prediction.elevationM), '—', '—', '—'],
    ['identity', 'Target body', TARGET_LABELS[target], '—', '—', '—'],
    [
      'identity',
      'Target-body location',
      body ? `${body.name} (${formatCoords(body.lat, body.lon)})` : 'not crosswalked',
      '—',
      '—',
      '—',
    ],
    ...classification.dimensions.map((dimension) => [
      'dimension',
      dimension.label,
      STATE_LABELS[dimension.state],
      '—',
      '—',
      `${dimension.basis} ${dimension.caveats.join(' ')}`,
    ]),
    ...classification.limitations.map((limit) => [
      'limit',
      limit.label,
      limit.earth,
      limit.target,
      '—',
      limit.why,
    ]),
  ];

  return {
    header: ['section', 'metric', 'value', 'target', 'gap', 'note'],
    rows,
  };
}

function dimensionHtml(verdict: DimensionVerdict): string {
  return `      <section class="dimension">
        <h3>${escapeXml(verdict.label)} <span class="state s-${verdict.state}">${escapeXml(
          STATE_LABELS[verdict.state],
        )}</span></h3>
        <p>${escapeXml(verdict.basis)}</p>
${verdict.caveats.map((caveat) => `        <p class="caveat">${escapeXml(caveat)}</p>`).join('\n')}
      </section>`;
}

function reportHtml(prediction: Prediction, target: Target): string {
  const classification = classifySite(prediction, target);
  const body = targetSiteOf(prediction, target);
  const title = `${prediction.siteName} — ${TARGET_LABELS[target]} classification`;

  const dimensionRows = classification.dimensions.map(dimensionHtml).join('\n');

  const limitRows = classification.limitations
    .map(
      (limit) => `        <tr>
          <th scope="row">${escapeXml(limit.label)}</th>
          <td>${escapeXml(limit.earth)}</td>
          <td>${escapeXml(limit.target)}</td>
          <td>${escapeXml(limit.why)}</td>
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
      h3 { margin: 0 0 6px; font-size: 14px; display: flex; gap: 10px; align-items: baseline; }
      .meta { margin: 0 0 22px; font-size: 12px; color: #5b6b7c; }
      .lede { font-size: 14px; max-width: 74ch; }
      .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 0; }
      .facts div { border: 1px solid #dbe2ea; border-radius: 6px; padding: 8px 10px; }
      .facts dt { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #5b6b7c; }
      .facts dd { margin: 2px 0 0; font-size: 13px; }
      .dimension { border-left: 3px solid #dbe2ea; padding: 2px 0 2px 14px; margin-bottom: 16px; }
      .dimension p { margin: 0 0 6px; }
      .caveat { font-size: 11.5px; color: #5b6b7c; }
      .state { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 7px; border-radius: 999px; border: 1px solid currentColor; }
      .s-similar { color: #92400e; }
      .s-different { color: #3730a3; }
      .s-insufficient_evidence { color: #0e7490; }
      .s-not_comparable { color: #4b5563; }
      table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
      th, td { padding: 7px 10px; border-bottom: 1px solid #dbe2ea; text-align: left; vertical-align: top; }
      thead th { background: #eef2f6; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; }
      footer { margin-top: 34px; font-size: 11px; color: #5b6b7c; border-top: 1px solid #dbe2ea; padding-top: 12px; }
      @media print { body { padding: 0; } h2 { page-break-after: avoid; } }
    </style>
  </head>
  <body>
    <h1>${escapeXml(prediction.siteName)}</h1>
    <p class="meta">
      ${escapeXml(terrainLabel(prediction))} terrain · ${escapeXml(
        formatCoords(prediction.lat, prediction.lon),
      )}
      · ${escapeXml(formatElevation(prediction.elevationM))} · classified against ${escapeXml(
        TARGET_LABELS[target],
      )}
      · exported ${new Date().toISOString().slice(0, 10)}
    </p>

    <dl class="facts">
      <div><dt>Target ground</dt><dd>${
        body ? escapeXml(body.name) : 'not crosswalked'
      }</dd></div>
      <div><dt>Target coords</dt><dd>${
        body ? escapeXml(formatCoords(body.lat, body.lon)) : '—'
      }</dd></div>
      <div><dt>Similar dimensions</dt><dd>${classification.agreements} of 3</dd></div>
      <div><dt>Terrain overlap</dt><dd>${
        classification.terrainOverlap === undefined
          ? 'not published'
          : `${Math.round(classification.terrainOverlap * 100)}%`
      }</dd></div>
    </dl>

    <p class="lede">${escapeXml(classificationSummary(classification))} No composite score is
      published: the three dimensions are independent, and one of them being similar says nothing
      about the other two.</p>

    <h2>Three dimensions against ${escapeXml(TARGET_LABELS[target])}</h2>
${dimensionRows}

    <h2>Physical differences no terrestrial site can close</h2>
    <table>
      <thead>
        <tr><th scope="col">Limit</th><th scope="col">Earth</th><th scope="col">${escapeXml(
          TARGET_LABELS[target],
        )}</th><th scope="col">Why it matters</th></tr>
      </thead>
      <tbody>
${limitRows}
      </tbody>
    </table>

    <h2>What each state means</h2>
    <table>
      <tbody>
${Object.entries(STATE_MEANINGS)
  .map(
    ([state, meaning]) =>
      `        <tr><th scope="row">${escapeXml(
        STATE_LABELS[state as keyof typeof STATE_LABELS],
      )}</th><td>${escapeXml(meaning)}</td></tr>`,
  )
  .join('\n')}
      </tbody>
    </table>

    <footer>
      Classified with Zehra's four evidence states over three independent dimensions. Terrain is
      measured from SRTM where a window is published and left insufficient where it is not;
      geology uses the USGS six-class crosswalk; thermal parameters await Diviner and TES ingestion.
      Model ${escapeXml(prediction.model.id)} ${escapeXml(prediction.model.version)}.
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
  /** Standalone page with the three verdicts. */
  html: string;
}

/** Everything the export dialog needs for one site, on the active target. */
export function siteReport(prediction: Prediction, target: Target): SiteReport {
  const classification = classifySite(prediction, target);
  const weakest = classification.dimensions.find((dimension) => dimension.state === 'different');

  return {
    title: `${prediction.siteName} · ${TARGET_LABELS[target]} classification`,
    filename: `site-classification-${slug(prediction.siteName)}-${target}`,
    subtitle: weakest
      ? `${classificationSummary(classification)} Geology and thermal are reported separately; no dimension is averaged into the others.`
      : `${classificationSummary(classification)} No dimension was measured as different.`,
    table: detailTable(prediction, target),
    html: reportHtml(prediction, target),
  };
}
