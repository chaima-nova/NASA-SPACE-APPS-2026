/**
 * Turning a table into the shapes people actually open: a real .xlsx, a table
 * Google Sheets can take, and a standalone .html page.
 *
 * Rows are passed as a header plus string cells, because the three writers below
 * only disagree on how to frame the same data. Keeping the framing here means a
 * new column is a one-line change in the producer, not three format changes.
 *
 * The .xlsx is written by hand — a store-only ZIP of the handful of XML parts
 * Excel needs — rather than pulling in a spreadsheet library for one button.
 *
 * The workbook is styled to match the HTML report it sits beside: a title block
 * above the data, the header row on a tinted band, alternating row shading and
 * hairline rules under every row. Columns are fitted to their contents instead
 * of a fixed width, so a sheet of short codes and a sheet of long notes both
 * arrive readable rather than half-hidden behind column borders.
 */

/** A table: column names, then one string array per row. */
export interface Table {
  header: string[];
  rows: string[][];
}

/** One worksheet: its data, plus the heading block written above it. */
export interface Sheet {
  name: string;
  table: Table;
  /** Report title, merged across the top row of the sheet. */
  title?: string;
  /** Provenance line under the title — row count, export date, caveats. */
  note?: string;
}

const encoder = new TextEncoder();

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** RFC-4180-ish CSV: quote every field, double any embedded quote. */
export function tableCsv(table: Table): string {
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [table.header, ...table.rows].map((row) => row.map(cell).join(',')).join('\r\n');
}

/**
 * Tab-separated text for the clipboard. Google Sheets splits a paste on tabs
 * and newlines, so this arrives as real cells rather than one string per row.
 */
export function tableTsv(table: Table): string {
  const cell = (value: string) => value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
  return [table.header, ...table.rows].map((row) => row.map(cell).join('\t')).join('\n');
}

/**
 * The table as styled markup, small enough to paste. Google Sheets keeps the
 * bold, the tinted header and the row shading when a clipboard entry carries
 * HTML, so this is what makes the Sheets hand-off look like the download; the
 * styles are inline because a pasted fragment has no stylesheet to inherit.
 */
export function tableHtmlFragment(title: string, table: Table, note = ''): string {
  const span = Math.max(table.header.length, 1);
  const head = table.header
    .map(
      (cell) =>
        `<th style="background:#eef2f6;border-bottom:1px solid #dbe2ea;font-size:10px;font-weight:700;padding:6px 10px;text-align:left;text-transform:uppercase">${escapeXml(
          cell,
        )}</th>`,
    )
    .join('');
  const body = table.rows
    .map((row, index) => {
      const shade = index % 2 === 1 ? 'background:#fafbfc;' : '';
      return `<tr>${row
        .map(
          (cell) =>
            `<td style="${shade}border-bottom:1px solid #dbe2ea;padding:6px 10px;vertical-align:top">${escapeXml(
              cell,
            )}</td>`,
        )
        .join('')}</tr>`;
    })
    .join('');
  return `<table cellspacing="0" cellpadding="0"><tr><td colspan="${span}" style="font-size:15px;font-weight:700;padding-bottom:2px">${escapeXml(
    title,
  )}</td></tr>${
    note
      ? `<tr><td colspan="${span}" style="color:#5b6b7c;font-size:11px;padding-bottom:10px">${escapeXml(
          note,
        )}</td></tr>`
      : ''
  }<tr>${head}</tr>${body}</table>`;
}

/** A standalone HTML page: no scripts, no external files, prints cleanly. */
export function tableHtml(title: string, table: Table): string {
  const head = table.header.map((cell) => `        <th scope="col">${escapeXml(cell)}</th>`).join('\n');
  const body = table.rows
    .map(
      (row) =>
        `      <tr>\n${row.map((cell) => `        <td>${escapeXml(cell)}</td>`).join('\n')}\n      </tr>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeXml(title)}</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        padding: 32px;
        font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
        color: #16202c;
        background: #ffffff;
      }
      h1 { margin: 0 0 4px; font-size: 20px; letter-spacing: -0.01em; }
      p.meta { margin: 0 0 20px; font-size: 12px; color: #5b6b7c; }
      table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
      caption { text-align: left; padding-bottom: 10px; color: #5b6b7c; font-size: 12px; }
      th, td { padding: 6px 10px; border-bottom: 1px solid #dbe2ea; text-align: left; vertical-align: top; }
      th { background: #eef2f6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
      tbody tr:nth-child(even) { background: #fafbfc; }
      @media print { body { padding: 0; } thead { display: table-header-group; } }
    </style>
  </head>
  <body>
    <h1>${escapeXml(title)}</h1>
    <p class="meta">${table.rows.length} row${table.rows.length === 1 ? '' : 's'} · exported ${new Date().toISOString().slice(0, 10)}</p>
    <table>
      <thead>
        <tr>
${head}
        </tr>
      </thead>
      <tbody>
${body}
      </tbody>
    </table>
  </body>
</html>
`;
}

/* ---------------------------------------------------------------- .xlsx ---- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS packed time/date, which is what a ZIP local header stores. */
function dosStamp(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/** A copy of the bytes as a plain ArrayBuffer, which `Blob` accepts as a part. */
function bufferOf(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

/** A ZIP archive with every entry stored (no compression) — an .xlsx is this. */
function zipStore(files: { name: string; data: Uint8Array }[]): Blob {
  const stamp = dosStamp(new Date());
  const parts: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);

    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true); // names are UTF-8
    localView.setUint16(8, 0, true); // stored
    localView.setUint16(10, stamp.time, true);
    localView.setUint16(12, stamp.date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, file.data.length, true);
    localView.setUint32(22, file.data.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);

    const entry = new Uint8Array(46 + name.length);
    const entryView = new DataView(entry.buffer);
    entryView.setUint32(0, 0x02014b50, true);
    entryView.setUint16(4, 20, true);
    entryView.setUint16(6, 20, true);
    entryView.setUint16(8, 0x0800, true);
    entryView.setUint16(10, 0, true);
    entryView.setUint16(12, stamp.time, true);
    entryView.setUint16(14, stamp.date, true);
    entryView.setUint32(16, crc, true);
    entryView.setUint32(20, file.data.length, true);
    entryView.setUint32(24, file.data.length, true);
    entryView.setUint16(28, name.length, true);
    entryView.setUint32(42, offset, true);
    entry.set(name, 46);

    parts.push(local, file.data);
    directory.push(entry);
    offset += local.length + file.data.length;
  }

  const directorySize = directory.reduce((total, entry) => total + entry.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, directorySize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...parts, ...directory, end].map(bufferOf), {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** A1, B1 … Z1, AA1 — the cell reference Excel expects. */
function columnName(index: number): string {
  let name = '';
  let value = index;
  while (value >= 0) {
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26) - 1;
  }
  return name;
}

/** Numbers stay numbers in Excel; everything else is written as an inline string. */
const NUMERIC = /^-?(0|[1-9]\d*)(\.\d+)?$/;

/**
 * Cell style ids, in the order `cellXfs` lists them in STYLES_XML below. The
 * palette is the HTML report's: ink on white, a #eef2f6 header band, #fafbfc
 * row shading and #dbe2ea rules.
 */
const XF = { body: 0, title: 1, note: 2, header: 3, cell: 4, band: 5 } as const;

function sheetCell(value: string, ref: string, style: number, numeric = false): string {
  if (value === '') return `<c r="${ref}" s="${style}"/>`;
  if (numeric && NUMERIC.test(value)) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

/**
 * The width a cell needs, in Excel's character units. Wide glyphs (CJK, most
 * symbols) are counted double, which is roughly how Excel measures them.
 */
function textWidth(value: string): number {
  let width = 0;
  for (const char of value) width += (char.codePointAt(0) ?? 0) > 0x2e80 ? 2 : 1;
  return width;
}

/**
 * Fit every column to its longest cell instead of fixing a width. The title and
 * note blocks are merged across the sheet, so they stay out of this: a long
 * provenance line should not stretch the first column to the screen edge.
 */
function columnWidths(sheet: Sheet): number[] {
  const columns = Math.max(sheet.table.header.length, 1);
  const widths = new Array<number>(columns).fill(9);
  const measure = (row: string[], padding: number) => {
    row.slice(0, columns).forEach((cell, index) => {
      widths[index] = Math.max(widths[index], Math.min(textWidth(cell) + padding, 52));
    });
  };
  measure(
    sheet.table.header.map((cell) => cell.toUpperCase()),
    3,
  );
  for (const row of sheet.table.rows) measure(row, 2);
  return widths;
}

/** Excel rejects these in a sheet name and caps it at 31 characters. */
function sheetName(title: string): string {
  const cleaned = title.replace(/[[\]:*?/\\]/g, '-').slice(0, 31).trim();
  return cleaned === '' ? 'Sites' : cleaned;
}

/**
 * One worksheet part: the heading block, a frozen header row, banded body rows
 * and fitted columns. The header freezes at whatever row it lands on, so the
 * title block scrolls away while the column names stay put.
 */
function sheetXml(sheet: Sheet): string {
  const table = sheet.table;
  const columns = Math.max(table.header.length, 1);
  const lastColumn = columnName(columns - 1);
  const rows: string[] = [];
  const merges: string[] = [];
  let rowIndex = 0;

  const push = (cells: string, height?: number) => {
    rowIndex += 1;
    rows.push(
      `<row r="${rowIndex}"${height ? ` ht="${height}" customHeight="1"` : ''}>${cells}</row>`,
    );
    return rowIndex;
  };

  if (sheet.title) {
    push(sheetCell(sheet.title, `A${rowIndex + 1}`, XF.title), 26);
    if (columns > 1) merges.push(`A${rowIndex}:${lastColumn}${rowIndex}`);
  }
  if (sheet.note) {
    push(sheetCell(sheet.note, `A${rowIndex + 1}`, XF.note), 16);
    if (columns > 1) merges.push(`A${rowIndex}:${lastColumn}${rowIndex}`);
  }
  // One empty row between the heading block and the data, so the header band
  // reads as the table's top edge rather than a second line of the intro.
  if (rows.length > 0) push('');

  const headerRow = push(
    table.header
      .map((cell, index) =>
        sheetCell(cell.toUpperCase(), `${columnName(index)}${rowIndex + 1}`, XF.header),
      )
      .join(''),
    20,
  );

  table.rows.forEach((row, rowNumber) => {
    const style = rowNumber % 2 === 1 ? XF.band : XF.cell;
    push(
      row
        .slice(0, columns)
        .map((cell, index) => sheetCell(cell, `${columnName(index)}${rowIndex + 1}`, style, true))
        .join(''),
    );
  });

  const cols = columnWidths(sheet)
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');

  // SheetML wants autoFilter before mergeCells; the reverse order makes Excel
  // offer to repair the file.
  const filter =
    table.rows.length > 0 ? `<autoFilter ref="A${headerRow}:${lastColumn}${rowIndex}"/>` : '';
  const merged =
    merges.length > 0
      ? `<mergeCells count="${merges.length}">${merges
          .map((ref) => `<mergeCell ref="${ref}"/>`)
          .join('')}</mergeCells>`
      : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="16"/><cols>${cols}</cols><sheetData>${rows.join(
    '',
  )}</sheetData>${filter}${merged}</worksheet>`;
}

/**
 * Six cell formats: default, report title, provenance note, column header,
 * body cell and shaded body cell. Fonts 0–4 are regular, bold, title, note and
 * header respectively; fills 2 and 3 are the header band and the row shading.
 */
const STYLES_XML = `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><sz val="11"/><color rgb="FF16202C"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FF16202C"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="15"/><color rgb="FF16202C"/><name val="Calibri"/><family val="2"/></font><font><i/><sz val="9"/><color rgb="FF5B6B7C"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="10"/><color rgb="FF16202C"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF2F6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFAFBFC"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFDBE2EA"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/**
 * A real .xlsx workbook: one tab per sheet, each styled like the HTML report.
 *
 * The export checklist can ask for the analysis and the itinerary together, and
 * one download with both tabs is what a field party actually hands on. Sheet
 * names are de-duplicated, because Excel refuses a workbook that repeats one.
 */
export function workbookXlsx(title: string, sheets: Sheet[]): Blob {
  const requested: Sheet[] =
    sheets.length > 0 ? sheets : [{ name: 'Sites', table: { header: ['empty'], rows: [] } }];

  const used: string[] = [];
  const tabs = requested.map((entry) => {
    const base = sheetName(entry.name);
    let name = base;
    let suffix = 2;
    while (used.includes(name)) {
      name = `${base.slice(0, 27)} (${suffix})`;
      suffix += 1;
    }
    used.push(name);
    return { ...entry, name };
  });

  const contentOverrides = tabs
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('');

  const sheetEntries = tabs
    .map(
      (tab, index) =>
        `<sheet name="${escapeXml(tab.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join('');

  const sheetRelationships = tabs
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join('');

  const files = [
    {
      name: '[Content_Types].xml',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${contentOverrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`),
    },
    {
      name: '_rels/.rels',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`),
    },
    {
      name: 'docProps/core.xml',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(title)}</dc:title><dc:creator>Lunar &amp; Mars analog site finder</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`),
    },
    {
      name: 'xl/workbook.xml',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries}</sheets></workbook>`),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRelationships}<Relationship Id="rId${tabs.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    },
    { name: 'xl/styles.xml', data: encoder.encode(STYLES_XML) },
    ...tabs.map((tab, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: encoder.encode(sheetXml(tab)),
    })),
  ];

  return zipStore(files);
}

/** A single-sheet workbook — the common case, and what every caller used before. */
export function tableXlsx(title: string, table: Table, sheetTitle: string): Blob {
  return workbookXlsx(title, [{ name: sheetTitle, table }]);
}

/**
 * Copies text, with a selection-based fallback for browsers where the async
 * clipboard is unavailable (a plain-http preview, for instance).
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '-1000px';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(field);
    return copied;
  }
}

/**
 * Copies both a styled fragment and a plain-text twin.
 *
 * Spreadsheet apps read the `text/html` flavour and keep the bold header and
 * the row shading; anything that only understands text still gets the tabs and
 * newlines from the plain twin. Browsers without the async clipboard API drop
 * to text alone rather than failing the paste.
 */
export async function copyRich(html: string, text: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
      return true;
    }
  } catch {
    // Fall through: a browser that refuses HTML on the clipboard still pastes text.
  }
  return copyText(text);
}
