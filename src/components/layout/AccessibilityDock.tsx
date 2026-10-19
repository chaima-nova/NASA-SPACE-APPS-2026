import { useEffect, useId, useRef, useState } from 'react';
import {
  TEXT_SCALES,
  type AccessibilitySettings,
  type TextScale,
} from '../../lib/accessibility';

interface AccessibilityDockProps {
  settings: AccessibilitySettings;
  onChange: <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K],
  ) => void;
  onReset: () => void;
}

const SCALE_LABEL: Record<TextScale, string> = {
  normal: 'Normal',
  large: 'Large',
  larger: 'Larger',
};

const SCALE_SAMPLE: Record<TextScale, string> = {
  normal: '0.82rem',
  large: '0.95rem',
  larger: '1.08rem',
};

/** One switch row: the whole row is the control, so the target is never tiny. */
function Switch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={checked ? 'a11y-switch is-on' : 'a11y-switch'}
      onClick={() => onChange(!checked)}
    >
      <span className="a11y-switch-body">
        <span className="a11y-switch-label">{label}</span>
        {hint ? <span className="a11y-switch-hint">{hint}</span> : null}
      </span>
      <span className="a11y-switch-track" aria-hidden="true">
        <span className="a11y-switch-knob" />
      </span>
    </button>
  );
}

/**
 * The site's accessibility settings, all of them behind one floating control in
 * the bottom-left corner so the workbench itself keeps its space.
 *
 * The groups are `<details>`: they nest the settings without a custom accordion,
 * come with keyboard handling for free, and the panel stays one screen tall.
 * The panel is a non-modal dialog — it never blocks the page underneath — and
 * closes on Escape or a click outside, returning focus to the button.
 */
export function AccessibilityDock({ settings, onChange, onReset }: AccessibilityDockProps) {
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const dockRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Land on the first setting, not on the close button: opening the panel is a
  // request to change something.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>('.a11y-body button') ??
      panel?.querySelector<HTMLElement>('.a11y-close'))?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        fabRef.current?.focus();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  /** Announces the new state, so a change is confirmed without sight of the switch. */
  const set = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K],
    message: string,
  ) => {
    onChange(key, value);
    setAnnouncement(message);
  };

  const on = settings.dyslexia || settings.highContrast || settings.reduceMotion;

  return (
    <div className="a11y-dock" ref={dockRef}>
      <button
        ref={fabRef}
        type="button"
        className={on ? 'a11y-fab has-active' : 'a11y-fab'}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
        title="Accessibility settings"
      >
        {/* The universal access mark, drawn to the same 1.5 px line recipe as
            the other icons on the surface. */}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="4.6" r="1.9" />
          <path d="M4.8 8.2c2.3.7 4.7 1.05 7.2 1.05S16.9 8.9 19.2 8.2" />
          <path d="M12 9.25v5.1" />
          <path d="M12 14.35 9.1 20.4" />
          <path d="M12 14.35l2.9 6.05" />
        </svg>
        <span className="sr-only">Accessibility settings</span>
      </button>

      {open ? (
        <div
          id={panelId}
          ref={panelRef}
          className="a11y-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Accessibility settings"
        >
          <header className="a11y-head">
            <div>
              <span className="kicker">Accessibility</span>
              <h2>Reading &amp; display</h2>
            </div>
            <button
              type="button"
              className="a11y-close"
              onClick={() => {
                setOpen(false);
                fabRef.current?.focus();
              }}
              aria-label="Close accessibility settings"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <div className="a11y-body">
            <details className="a11y-group" open>
              <summary>Reading</summary>

              <Switch
                label="Dyslexia-friendly text"
                hint="Lexend type, wider letter and word spacing, taller lines"
                checked={settings.dyslexia}
                onChange={(next) =>
                  set(
                    'dyslexia',
                    next,
                    next ? 'Dyslexia-friendly text on' : 'Dyslexia-friendly text off',
                  )
                }
              />

              <div className="a11y-row">
                <span className="a11y-row-label" id={`${panelId}-size`}>
                  Text size
                </span>
                <div
                  className="a11y-seg"
                  role="radiogroup"
                  aria-labelledby={`${panelId}-size`}
                >
                  {TEXT_SCALES.map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      role="radio"
                      aria-checked={settings.textScale === scale}
                      className={
                        settings.textScale === scale ? 'a11y-seg-btn is-on' : 'a11y-seg-btn'
                      }
                      style={{ fontSize: SCALE_SAMPLE[scale] }}
                      onClick={() => set('textScale', scale, `Text size ${SCALE_LABEL[scale]}`)}
                    >
                      {SCALE_LABEL[scale]}
                    </button>
                  ))}
                </div>
              </div>

              <Switch
                label="Underline links"
                hint="Links stay distinct from the text around them"
                checked={settings.underlineLinks}
                onChange={(next) =>
                  set('underlineLinks', next, next ? 'Links underlined' : 'Underlines removed')
                }
              />
            </details>

            <details className="a11y-group">
              <summary>Contrast</summary>
              <Switch
                label="High contrast"
                hint="Brighter text, stronger rules, no photograph behind the panels"
                checked={settings.highContrast}
                onChange={(next) =>
                  set('highContrast', next, next ? 'High contrast on' : 'High contrast off')
                }
              />
            </details>

            <details className="a11y-group">
              <summary>Motion</summary>
              <Switch
                label="Reduce motion"
                hint="Stops the globe's spin, the panel tilt and every transition"
                checked={settings.reduceMotion}
                onChange={(next) =>
                  set('reduceMotion', next, next ? 'Motion reduced' : 'Motion restored')
                }
              />
            </details>
          </div>

          <footer className="a11y-foot">
            <button type="button" className="a11y-reset" onClick={onReset}>
              Reset all
            </button>
            <span className="a11y-saved">Saved on this device</span>
          </footer>

          <p className="sr-only" aria-live="polite">
            {announcement}
          </p>
        </div>
      ) : null}
    </div>
  );
}
