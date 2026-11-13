import { useState } from 'react';
import { Modal } from './Modal';
import { downloadBlob, downloadFile } from '../../lib/download';
import { copyText, tableHtml, tableTsv, tableXlsx, type Table } from '../../lib/export';

interface ExportDialogProps {
  /** Heading for the file, e.g. "Lunar analog sites · Moon". */
  title: string;
  /** File name without an extension; each option appends its own. */
  filename: string;
  /** Workbook tab name; the HTML page and the sheet hand-off ignore it. */
  sheet?: string;
  /** The rows to write, already filtered to what is on screen. */
  table: Table;
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
 * The export step, shared by every "Export" button: one row per destination,
 * each with its own logo, so the choice reads as "where do you want this?"
 * rather than "which file format do you want?".
 *
 * The Google Sheets row copies the table to the clipboard before opening a new
 * sheet. That is the one path that works with no OAuth client and no API key,
 * and it lands the data as real cells rather than one long string.
 */
export function ExportDialog({
  title,
  filename,
  sheet = 'Sites',
  table,
  subtitle,
  onClose,
}: ExportDialogProps) {
  const [status, setStatus] = useState<string | null>(null);

  function saveExcel() {
    downloadBlob(`${filename}.xlsx`, tableXlsx(title, table, sheet));
    onClose();
  }

  function sendToSheets() {
    // The tab is opened inside the click, before the clipboard write is
    // awaited: a window opened after an await is treated as a popup and
    // blocked. The copy then finishes behind the new tab.
    window.open('https://sheets.new', '_blank', 'noopener');
    void copyText(tableTsv(table)).then((copied) =>
      setStatus(
        copied
          ? 'Table copied. Paste it into the new sheet with Ctrl+V (⌘V on a Mac).'
          : 'New sheet opened. Copy the table from the app and paste it in with Ctrl+V.',
      ),
    );
  }

  function saveHtml() {
    downloadFile(`${filename}.html`, tableHtml(title, table), 'text/html');
    onClose();
  }

  return (
    <Modal
      kicker="Export"
      title="Take this ranking with you"
      subtitle={subtitle}
      onClose={onClose}
      className="export-modal"
    >
      <div className="export-options">
        <button type="button" className="export-option" onClick={saveExcel}>
          <ExcelLogo />
          <span className="export-option-text">
            <span className="export-option-label">Export to Excel</span>
            <span className="export-option-hint">
              A .xlsx workbook with one sheet, frozen header and real numbers.
            </span>
          </span>
        </button>

        <button type="button" className="export-option" onClick={sendToSheets}>
          <SheetsLogo />
          <span className="export-option-text">
            <span className="export-option-label">Export to Google Sheets</span>
            <span className="export-option-hint">
              Copies the table, then opens a blank sheet to paste into.
            </span>
          </span>
        </button>

        <button type="button" className="export-option" onClick={saveHtml}>
          <HtmlLogo />
          <span className="export-option-text">
            <span className="export-option-label">Export to HTML</span>
            <span className="export-option-hint">
              A standalone .html table that opens in any browser and prints cleanly.
            </span>
          </span>
        </button>
      </div>

      <p className={status ? 'export-status is-on' : 'export-status'} role="status">
        {status ?? ''}
      </p>
    </Modal>
  );
}
