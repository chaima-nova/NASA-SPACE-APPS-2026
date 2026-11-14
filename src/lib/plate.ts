/**
 * The evidence plate: four figures on one sheet, drawn as one SVG.
 *
 * The reference figure for this page is the multi-panel kind scientific
 * reporting uses — a map, a loop, a scatter, a deconvolution — read as a single
 * plate rather than four separate pictures. The same idea here, with the panels
 * this app can actually populate: how the pillar scores compare to the peers,
 * what moved the score, where the site sits in the distribution, and how the
 * two target fits trade off against each other.
 *
 * The drawing is a pure string: no DOM, no measuring, no CSS variables. That is
 * what lets the identical figure go into the standalone HTML page and be
 * rasterised for the workbook without the two drifting apart. Colours are
 * written as hex for the same reason — an SVG inside an <img> or a canvas
 * cannot resolve the app's custom properties.
 */

export interface PlateAxis {
  label: string;
  /** This site's pillar score, [0, 1]. */
  site: number;
  /** Mean pillar score across the peer sites, [0, 1]. */
  peers: number;
  /** What a permanent base on the target body demands, [0, 1]. */
  demand: number;
}

export interface PlateInput {
  siteName: string;
  targetLabel: string;
  axes: PlateAxis[];
  /** Signed feature contributions, largest magnitude first or not — sorted here. */
  contributions: { label: string; value: number }[];
  /** Analog-fit score for every site, plus this site's own anchor. */
  distribution: { values: number[]; site: number };
  /** Every site's two fits; `current` marks the one the report is about. */
  scatter: { moon: number; mars: number; name: string; current: boolean }[];
}

const INK = '#16202c';
const SUB = '#5b6b7c';
const LINE = '#e3e8ee';
const GRID = '#eef1f5';
const TEAL = '#0f7d8c';
const AMBER = '#c97b1a';
const VIOLET = '#6b5bd2';

const esc = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const n = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '0');
const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/** Panel frame: hairline card, an a/b/c/d letter and the caption above the plot. */
function card(x: number, y: number, w: number, h: number, letter: string, title: string): string {
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#ffffff" stroke="${LINE}" />
    <text x="${x + 14}" y="${y + 22}" font-size="12" font-weight="700" fill="${INK}">${letter}</text>
    <text x="${x + 28}" y="${y + 22}" font-size="11.5" font-weight="600" fill="${INK}">${esc(title)}</text>`;
}

/** Radar: the site against the peer mean and the target body's demand. */
function radarPanel(
  x: number,
  y: number,
  w: number,
  h: number,
  axes: PlateAxis[],
): string {
  const cx = x + w / 2 - 10;
  const cy = y + h / 2 + 12;
  const radius = Math.min(w, h) / 2 - 74;
  const count = Math.max(axes.length, 3);
  const angle = (index: number) => (Math.PI * 2 * index) / count - Math.PI / 2;
  const point = (index: number, value: number) => {
    const r = clamp01(value) * radius;
    return [cx + Math.cos(angle(index)) * r, cy + Math.sin(angle(index)) * r] as const;
  };
  const ring = (value: number) => {
    const path = axes
      .map((_, index) => point(index, value))
      .map(([px, py], index) => `${index === 0 ? 'M' : 'L'}${n(px)} ${n(py)}`)
      .join(' ');
    return `<path d="${path} Z" fill="none" stroke="${GRID}" stroke-width="1" />`;
  };
  const polygon = (key: 'site' | 'peers' | 'demand', stroke: string, fill: string, dash = '') => {
    const points = axes.map((axis, index) => point(index, axis[key]));
    const path = points
      .map(([px, py], index) => `${index === 0 ? 'M' : 'L'}${n(px)} ${n(py)}`)
      .join(' ');
    return `<path d="${path} Z" fill="${fill}" stroke="${stroke}" stroke-width="1.4"${
      dash ? ` stroke-dasharray="${dash}"` : ''
    } />`;
  };

  const spokes = axes
    .map((axis, index) => {
      const [px, py] = point(index, 1);
      const [lx, ly] = point(index, 1.26);
      const anchor = Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end';
      return `<line x1="${cx}" y1="${cy}" x2="${n(px)}" y2="${n(py)}" stroke="${GRID}" />
        <text x="${n(lx)}" y="${n(ly + 4)}" font-size="9.5" fill="${SUB}" text-anchor="${anchor}">${esc(
          axis.label,
        )}</text>`;
    })
    .join('');

  const dots = axes
    .map((axis, index) => {
      const [px, py] = point(index, axis.site);
      return `<circle cx="${n(px)}" cy="${n(py)}" r="2.6" fill="${TEAL}" />`;
    })
    .join('');

  const legend = [
    [TEAL, 'This site', ''],
    [SUB, 'Peer mean', '3 2'],
    [AMBER, 'Target demand', ''],
  ]
    .map(
      ([colour, label, dash], index) => `<g transform="translate(${x + 16}, ${y + h - 44 + index * 13})">
        <line x1="0" y1="0" x2="16" y2="0" stroke="${colour}" stroke-width="2"${
          dash ? ` stroke-dasharray="${dash}"` : ''
        } />
        <text x="22" y="3.5" font-size="9.5" fill="${SUB}">${label}</text>
      </g>`,
    )
    .join('');

  return `${card(x, y, w, h, 'a', 'Pillar profile against peers and demand')}
    ${[0.25, 0.5, 0.75, 1].map(ring).join('')}
    ${spokes}
    ${polygon('demand', AMBER, 'rgba(201,123,26,0.10)')}
    ${polygon('peers', SUB, 'rgba(91,107,124,0.08)', '3 2')}
    ${polygon('site', TEAL, 'rgba(15,125,140,0.16)')}
    ${dots}
    ${legend}
  </g>`;
}

/** Diverging bars: what each feature added to, or took from, the score. */
function contributionPanel(
  x: number,
  y: number,
  w: number,
  h: number,
  rows: { label: string; value: number }[],
): string {
  const visible = rows.slice(0, 8);
  const ceiling = Math.max(...visible.map((row) => Math.abs(row.value)), 0.0001);
  const zero = x + w - 132;
  const span = 96;
  const top = y + 44;
  const step = Math.min(26, (h - 74) / Math.max(visible.length, 1));

  const bars = visible
    .map((row, index) => {
      const cy = top + index * step;
      const width = (Math.abs(row.value) / ceiling) * span;
      const positive = row.value >= 0;
      const barX = positive ? zero : zero - width;
      const colour = positive ? TEAL : AMBER;
      const name = row.label.length > 18 ? `${row.label.slice(0, 17)}…` : row.label;
      return `<text x="${x + 14}" y="${n(cy + 10)}" font-size="9.5" fill="${INK}">${esc(name)}</text>
        <rect x="${n(barX)}" y="${n(cy + 3)}" width="${n(Math.max(width, 1))}" height="9" rx="2" fill="${colour}" opacity="0.85" />
        <text x="${x + w - 14}" y="${n(cy + 11)}" font-size="9.5" fill="${SUB}" text-anchor="end">${row.value.toFixed(
          3,
        )}</text>`;
    })
    .join('');

  return `${card(x, y, w, h, 'b', 'What moved the score')}
    <line x1="${zero}" y1="${y + 36}" x2="${zero}" y2="${y + h - 22}" stroke="${LINE}" />
    <text x="${zero - span}" y="${y + h - 12}" font-size="8.5" fill="${SUB}">takes away</text>
    <text x="${zero + 6}" y="${y + h - 12}" font-size="8.5" fill="${SUB}">adds</text>
    ${bars}
  </g>`;
}

/** Histogram of every site's fit, with this site's position marked. */
function distributionPanel(
  x: number,
  y: number,
  w: number,
  h: number,
  input: PlateInput['distribution'],
): string {
  const bins = 10;
  const counted = new Array(bins).fill(0) as number[];
  input.values.forEach((value) => {
    const index = Math.min(bins - 1, Math.max(0, Math.floor(clamp01(value) * bins)));
    counted[index] += 1;
  });
  const tallest = Math.max(...counted, 1);
  const left = x + 26;
  const right = x + w - 20;
  const base = y + h - 34;
  const top = y + 44;
  const slot = (right - left) / bins;
  const barWidth = slot - 4;

  const bars = counted
    .map((count, index) => {
      const height = (count / tallest) * (base - top);
      const bx = left + index * slot + 2;
      return `<rect x="${n(bx)}" y="${n(base - height)}" width="${n(barWidth)}" height="${n(
        Math.max(height, count > 0 ? 2 : 0),
      )}" rx="1.5" fill="${TEAL}" opacity="${0.35 + 0.5 * (index / bins)}" />
        <text x="${n(bx + barWidth / 2)}" y="${n(base + 12)}" font-size="8" fill="${SUB}" text-anchor="middle">${(
          index / bins
        ).toFixed(1)}</text>`;
    })
    .join('');

  const markerX = left + clamp01(input.site) * (right - left);
  return `${card(x, y, w, h, 'c', 'Where this site sits in the field')}
    <line x1="${left}" y1="${base}" x2="${right}" y2="${base}" stroke="${LINE}" />
    <line x1="${n(markerX)}" y1="${top - 6}" x2="${n(markerX)}" y2="${base}" stroke="${AMBER}" stroke-width="1.4" stroke-dasharray="4 2" />
    <text x="${n(markerX)}" y="${top - 12}" font-size="9" fill="${AMBER}" text-anchor="${
      markerX > right - 60 ? 'end' : 'middle'
    }">this site ${(clamp01(input.site) * 100).toFixed(0)}%</text>
    <text x="${left}" y="${base + 26}" font-size="8.5" fill="${SUB}">analog fit, ${bins} bins over ${
    input.values.length
  } sites</text>
    ${bars}
  </g>`;
}

/** Moon fit against Mars fit: the trade-off every site makes. */
function scatterPanel(
  x: number,
  y: number,
  w: number,
  h: number,
  points: PlateInput['scatter'],
): string {
  const left = x + 44;
  const right = x + w - 22;
  const top = y + 44;
  const bottom = y + h - 44;
  const px = (value: number) => left + clamp01(value) * (right - left);
  const py = (value: number) => bottom - clamp01(value) * (bottom - top);

  const grid = [0.25, 0.5, 0.75, 1]
    .map(
      (value) => `<line x1="${n(px(value))}" y1="${top}" x2="${n(px(value))}" y2="${bottom}" stroke="${GRID}" />
        <line x1="${left}" y1="${n(py(value))}" x2="${right}" y2="${n(py(value))}" stroke="${GRID}" />
        <text x="${n(px(value))}" y="${bottom + 13}" font-size="8" fill="${SUB}" text-anchor="middle">${value.toFixed(
          2,
        )}</text>
        <text x="${left - 8}" y="${n(py(value) + 3)}" font-size="8" fill="${SUB}" text-anchor="end">${value.toFixed(
          2,
        )}</text>`,
    )
    .join('');

  const dots = points
    .map((point) => {
      const cx = px(point.moon);
      const cy = py(point.mars);
      const title = `${point.name}: moon ${point.moon.toFixed(2)}, mars ${point.mars.toFixed(2)}`;
      return point.current
        ? `<circle cx="${n(cx)}" cy="${n(cy)}" r="6" fill="none" stroke="${AMBER}" stroke-width="1.6" />
          <circle cx="${n(cx)}" cy="${n(cy)}" r="2.8" fill="${AMBER}"><title>${esc(title)}</title></circle>`
        : `<circle cx="${n(cx)}" cy="${n(cy)}" r="3" fill="${VIOLET}" opacity="0.55"><title>${esc(
            title,
          )}</title></circle>`;
    })
    .join('');

  return `${card(x, y, w, h, 'd', 'Moon fit against Mars fit')}
    ${grid}
    <line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${SUB}" stroke-width="0.8" />
    <line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="${SUB}" stroke-width="0.8" />
    <text x="${(left + right) / 2}" y="${y + h - 12}" font-size="9" fill="${SUB}" text-anchor="middle">Moon fit</text>
    <text transform="translate(${x + 14}, ${(top + bottom) / 2}) rotate(-90)" font-size="9" fill="${SUB}" text-anchor="middle">Mars fit</text>
    ${dots}
  </g>`;
}

/**
 * The whole plate. 960 units wide, laid out 2×2, on paper white — the same
 * aspect whether it lands on a printed page, an <img> in a cell or a screen.
 */
export function plateSvg(input: PlateInput): string {
  const margin = 28;
  const width = 960;
  const panelWidth = (width - margin * 2 - 18) / 2;
  const panelHeight = 268;
  const secondRow = margin + panelHeight + 34;
  const height = secondRow + panelHeight + 52;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Evidence plate for ${esc(
    input.siteName,
  )} against ${esc(input.targetLabel)}">
    <rect width="${width}" height="${height}" fill="#ffffff" />
    <text x="${margin}" y="20" font-size="11" font-weight="700" letter-spacing="1.2" fill="${SUB}">EVIDENCE PLATE</text>
    <text x="${width - margin}" y="20" font-size="10" fill="${SUB}" text-anchor="end">${esc(
      input.siteName,
    )} · ${esc(input.targetLabel)}</text>
    ${radarPanel(margin, margin + 14, panelWidth, panelHeight, input.axes)}
    ${contributionPanel(margin + panelWidth + 18, margin + 14, panelWidth, panelHeight, input.contributions)}
    ${distributionPanel(margin, secondRow, panelWidth, panelHeight, input.distribution)}
    ${scatterPanel(margin + panelWidth + 18, secondRow, panelWidth, panelHeight, input.scatter)}
    <text x="${margin}" y="${height - 16}" font-size="9.5" font-style="italic" fill="${SUB}">Figure 1 — Model evidence for ${esc(
      input.siteName,
    )}: pillar scores, score drivers, position in the field and the Moon/Mars trade-off. Model estimates, not measurements.</text>
  </svg>`;
}

/**
 * Rasterise a plate for the workbook, which can only hold bitmaps.
 *
 * Returns null rather than throwing when the browser cannot decode the SVG or
 * has no canvas: a workbook without the figure is a much better outcome than a
 * workbook that fails to download.
 */
export async function platePng(
  svg: string,
  width: number,
  height: number,
  scale = 2,
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  try {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const bitmap = await createImageBitmap(blob);
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(Math.round(width * scale), Math.round(height * scale))
        : Object.assign(document.createElement('canvas'), {
            width: Math.round(width * scale),
            height: Math.round(height * scale),
          });
    const context = (canvas as HTMLCanvasElement).getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!context) return null;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const out =
      'convertToBlob' in canvas
        ? await (canvas as OffscreenCanvas).convertToBlob({ type: 'image/png' })
        : await new Promise<Blob | null>((resolve) =>
            (canvas as HTMLCanvasElement).toBlob(resolve, 'image/png'),
          );
    if (!out) return null;
    return {
      bytes: new Uint8Array(await out.arrayBuffer()),
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    };
  } catch {
    return null;
  }
}

/** The plate's own dimensions, so callers can size the image without parsing it. */
export const PLATE_WIDTH = 960;
export const PLATE_HEIGHT = 28 + 14 + 268 + 34 + 268 + 52;
