import type { ChangeEvent, Ref } from 'react';

interface PhotoButtonProps {
  /** True while the chosen file is being decoded and shrunk. */
  busy: boolean;
  /** Describes the control to a screen reader, not the label beside it. */
  ariaLabel: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * The photo picker both forms use: a full-width button carrying the native file
 * input, the words "Upload Photo" centred over an upload mark.
 *
 * The native input stays in the tree — it owns the picker dialog and the
 * keyboard behaviour — but it is drawn off-screen behind this button because
 * "No file chosen" does not fit a dossier column and is not what a researcher
 * is looking for.
 */
export function PhotoButton({ busy, ariaLabel, onChange, inputRef }: PhotoButtonProps) {
  return (
    <label className={busy ? 'btn photo-pick is-busy' : 'btn photo-pick'}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="photo-input"
        onChange={onChange}
        disabled={busy}
        aria-label={ariaLabel}
      />
      <span className="photo-pick-text">{busy ? 'Preparing…' : 'Upload Photo'}</span>
      <svg className="photo-pick-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 15.5V4" />
        <path d="M7.6 8.2 12 3.8l4.4 4.4" />
        <path d="M4.5 14.6v3.9A2 2 0 0 0 6.5 20.5h11a2 2 0 0 0 2-2v-3.9" />
      </svg>
    </label>
  );
}
