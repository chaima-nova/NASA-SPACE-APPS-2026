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
 */

/** A table: column names, then one string array per row. */
export interface Table {
  header: string[];
  rows: string[][];
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

function sheetCell(value: string, ref: string, header: boolean): string {
  const style = header ? ' s="1"' : '';
  if (value === '') return '';
  if (!header && NUMERIC.test(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

/** Excel rejects these in a sheet name and caps it at 31 characters. */
function sheetName(title: string): string {
  const cleaned = title.replace(/[[\]:*?/\\]/g, '-').slice(0, 31).trim();
  return cleaned === '' ? 'Sites' : cleaned;
}

/** A real .xlsx workbook with one sheet and a bold header row. */
export function tableXlsx(title: string, table: Table, sheetTitle: string): Blob {
  const rows = [table.header, ...table.rows];
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) =>
          sheetCell(cell, `${columnName(columnIndex)}${rowIndex + 1}`, rowIndex === 0),
        )
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${table.header
    .map((_, index) => `<col min="${index + 1}" max="${index + 1}" width="18" customWidth="1"/>`)
    .join('')}</cols><sheetData>${sheetRows}</sheetData></worksheet>`;

  const files = [
    {
      name: '[Content_Types].xml',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`),
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
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(
        sheetName(sheetTitle),
      )}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    },
    {
      name: 'xl/styles.xml',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`),
    },
    { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(document) },
  ];

  return zipStore(files);
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
