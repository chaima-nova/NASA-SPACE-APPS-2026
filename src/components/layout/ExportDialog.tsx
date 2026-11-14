import { useState } from 'react';
import { Modal } from './Modal';
import { downloadBlob, downloadFile } from '../../lib/download';
import {
  copyRich,
  tableHtml,
  tableHtmlFragment,
  tableTsv,
  workbookXlsx,
  type Table,
} from '../../lib/export';
import type { TravelExport } from '../../lib/travel';

interface ExportDialogProps {
  /** Heading for the file, e.g. "Lunar analog sites · Moon". */
  title: string;
  /** File name without an extension; each option appends its own. */
  filename: string;
  /** Workbook tab name; the HTML page and the sheet hand-off ignore it. */
  sheet?: string;
  /** The rows to write, already filtered to what is on screen. */
  table: Table;
  /**
   * A full standalone page to write instead of a bare table — the per-site
   * analysis, with its charts. Falls back to a table page when absent.
   */
  html?: string;
  /** The itinerary the reader can add as a second tab, when one can be built. */
  travel?: TravelExport | null;
  subtitle: string;
  onClose: () => void;
}

function ExcelLogo() {
  return (
    <svg className="export-option-logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#1d6f42" />
      <path
        d="M11.4 10.6 20.6 21.4M20.6 10.6 11.4 21.4"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SheetsLogo() {
  return (
    <svg className="export-option-logo" viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M19 2.5H8.5A2.5 2.5 0 0 0 6 5v22a2.5 2.5 0 0 0 2.5 2.5h15A2.5 2.5 0 0 0 26 27V9.5z"
        fill="#0f9d58"
      />
      <path d="M19 2.5 26 9.5h-7z" fill="#0b7b45" />
      <path d="M10.8 14.2h10.4v9.6H10.8z" fill="#ffffff" />
      <path
        d="M14.3 14.2v9.6M17.7 14.2v9.6M10.8 17.4h10.4M10.8 20.6h10.4"
        fill="none"
        stroke="#0f9d58"
        strokeWidth="1.15"
      />
    </svg>
  );
}

function HtmlLogo() {
  return (
    <svg className="export-option-logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#e44d26" />
      <path
        d="M13.6 11.4 9.2 16l4.4 4.6M18.4 11.4 22.8 16l-4.4 4.6M17.6 10.2l-3.2 11.6"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The export step: a checklist of what to include on the left, a destination on
 * the right.
 *
 * Picking the destination first made the reader commit a file before deciding
 * whether the itinerary belonged in it. Now both choices are visible at once,
 * and the workbook writes one tab per checked item — the analysis on one, the
 * cheapest and fastest journeys on the other — because a field party hands on a
 * single file, not one download per subject.
 *
 * The Google Sheets row copies the table to the clipboard before opening a new
 * sheet: that is the one path that works with no OAuth client and no API key,
 * and it lands the data as real cells. Where two tabs are asked for, a second
 * copy button appears, since a paste fills one tab at a time.
 */
export function ExportDialog({
  title,
  filename,
  sheet = 'Sites',
  table,
  html,
  travel = null,
  subtitle,
  onClose,
}: ExportDialogProps) {
  const [includeSite, setIncludeSite] = useState(true);
  const [includeTravel, setIncludeTravel] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // The provenance line the HTML page opens with; the workbook and the pasted
  // tab carry it too, so all three exports agree on what was captured and when.
  const note = `${table.rows.length} row${table.rows.length === 1 ? '' : 's'} · exported ${new Date()
    .toISOString()
    .slice(0, 10)}`;

  const travelReady = Boolean(travel?.available);
  const withTravel = includeTravel && travelReady && travel !== null;
  const chosen = (includeSite ? 1 : 0) + (withTravel ? 1 : 0);
  const nothingChosen = chosen === 0;

  function saveExcel() {
    const sheets = [
      ...(includeSite ? [{ name: sheet, title, note, table }] : []),
      ...(withTravel && travel
        ? [{ name: 'Travel itinerary', title: `${title} · travel`, note: travel.note, table: travel.table }]
        : []),
    ];
    downloadBlob(`${filename}.xlsx`, workbookXlsx(title, sheets));
    onClose();
  }

  function sendToSheets() {
    const primary = includeSite ? table : travel && withTravel ? travel.table : null;
    if (!primary) return;
    // The tab is opened inside the click, before the clipboard write is
    // awaited: a window opened after an await is treated as a popup and
    // blocked. The copy then finishes behind the new tab.
    window.open('https://sheets.new', '_blank', 'noopener');
    // Both flavours go on the clipboard: Sheets keeps the header band and the
    // row shading from the HTML twin, and a plain-text reader still gets cells.
    void copyRich(tableHtmlFragment(title, primary, note), tableTsv(primary)).then((copied) =>
      setStatus(
        copied
          ? `Table copied. Paste it into the new sheet with Ctrl+V (⌘V on a Mac).${
              includeSite && withTravel ? ' Then use "Copy travel tab" for the second one.' : ''
            }`
          : 'New sheet opened. Copy the table from the app and paste it in with Ctrl+V.',
      ),
    );
  }

  function saveHtml() {
    const page = includeSite
      ? (html ?? tableHtml(title, table))
      : travel
        ? tableHtml(title, travel.table)
        : tableHtml(title, table);
    const withItinerary =
      includeSite && withTravel && travel ? page.replace('</body>', `${travel.html}\n  </body>`) : page;
    downloadFile(`${filename}.html`, withItinerary, 'text/html');
    onClose();
  }

  return (
    <Modal
      kicker="Export"
      title="Take this analysis with you"
      subtitle={subtitle}
      onClose={onClose}
      size="lg"
      className="export-modal"
    >
      <div className="export-layout">
        <fieldset className="export-include">
          <legend>Include</legend>

          <label className="export-check">
            <input
              type="checkbox"
              checked={includeSite}
              onChange={(event) => setIncludeSite(event.target.checked)}
            />
            <span className="export-check-name">Analogue site data</span>
          </label>

          <label className="export-check">
            <input
              type="checkbox"
              checked={includeTravel && travelReady}
              disabled={!travelReady}
              onChange={(event) => setIncludeTravel(event.target.checked)}
            />
            <span className="export-check-name">Travel itinerary</span>
          </label>
        </fieldset>

        <fieldset className="export-destinations">
          <legend>File type</legend>

          <div className="export-options">
            <button type="button" className="export-option" disabled={nothingChosen} onClick={saveExcel}>
              <ExcelLogo />
              <span className="export-option-text">
                <span className="export-option-label">Export to Excel</span>
                <span className="export-option-hint">
                  {chosen > 1
                    ? 'One workbook, two tabs: the analysis and the itinerary.'
                    : 'One styled sheet: every metric, the target\'s demand and the gap, plus the raw features, with columns fitted to their contents.'}
                </span>
              </span>
            </button>

            <button
              type="button"
              className="export-option"
              disabled={nothingChosen}
              onClick={sendToSheets}
            >
              <SheetsLogo />
              <span className="export-option-text">
                <span className="export-option-label">Export to Google Sheets</span>
                <span className="export-option-hint">
                  Copies the same styled table, then opens a blank sheet.
                </span>
              </span>
            </button>

            <button type="button" className="export-option" disabled={nothingChosen} onClick={saveHtml}>
              <HtmlLogo />
              <span className="export-option-text">
                <span className="export-option-label">Export to HTML</span>
                <span className="export-option-hint">
                  A standalone report: score ring, pillar charts, mismatch table, prints cleanly.
                </span>
              </span>
            </button>
          </div>
        </fieldset>

        {/* Status and the second-tab copy sit under the two panels: inside the
            file-type box they would make it taller than the checklist. */}
        <div className="export-foot">
          <p className={status ? 'export-status is-on' : 'export-status'} role="status">
            {status ?? ''}
          </p>

          {includeSite && withTravel && travel ? (
            <button
              type="button"
              className="btn btn-small export-copy-tab"
              onClick={() =>
                void copyRich(
                  tableHtmlFragment(`${title} · travel`, travel.table, travel.note),
                  tableTsv(travel.table),
                ).then((copied) =>
                  setStatus(
                    copied
                      ? 'Travel itinerary copied. Paste it into a second tab of the same sheet.'
                      : 'Could not copy the itinerary; the Excel export carries both tabs.',
                  ),
                )
              }
            >
              Copy travel tab
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
