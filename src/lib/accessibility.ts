/**
 * Reader accessibility settings, expressed as a *mode* first.
 *
 * The interface used to ask people to assemble their own combination of
 * switches, which assumes the reader already knows the vocabulary. A mode
 * answers the only question anyone actually arrives with: "which of these am
 * I?" One click sets a whole bundle, and the panel describes the bundle in
 * plain words. Fine-tuning stays available underneath for the people who want
 * it, and any tweak made there simply wins over the bundle.
 *
 * There are two modes and not three on purpose. The site makes no sound and
 * carries no video, so a deaf mode would have nothing to turn off — an inert
 * button is worse than no button. The panel says so instead of pretending.
 *
 * The record is applied to the document as data attributes and a root font
 * size rather than through the component tree. That is deliberate: the
 * preferences have to reach things React does not render — the WebGL scenes
 * with their own animation loops, the CSS-only backdrop wash — and a root
 * attribute is the one place all of them can read.
 *
 * Reads are defensive in the same way `community.ts` is: a hand-edited or stale
 * entry falls back to the defaults instead of taking the page down. The OS
 * setting is honoured as the starting point, so a reader who has already asked
 * their machine for less motion is not made to ask twice.
 */

import { useCallback, useEffect, useState } from 'react';

export type TextScale = 'normal' | 'large' | 'larger';

export const TEXT_SCALES: readonly TextScale[] = ['normal', 'large', 'larger'];

/** What the visitor says they need. `none` is the ordinary interface. */
export type Mode = 'blind' | 'dyslexia' | 'none';

export const MODES: readonly Mode[] = ['blind', 'dyslexia', 'none'];

export interface AccessibilitySettings {
  /**
   * The chosen bundle. The fields below are the bundle as applied, so a
   * fine-tune edit can change them without pretending the mode changed.
   */
  mode: Mode;
  /** Lexend type, wider letter and word spacing, taller lines. */
  dyslexia: boolean;
  textScale: TextScale;
  underlineLinks: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
}

type Bundle = Omit<AccessibilitySettings, 'mode'>;

/**
 * The bundles, in the words the panel uses for them:
 *
 *  - blind: text first. The largest type in the app, high contrast, links
 *    underlined, motion off (a spinning globe helps nobody who is listening),
 *    and — from `App.tsx` — skip links, a spoken description of the globe and
 *    an announcement of every site as it is selected.
 *  - dyslexia: Lexend with wider letter and word spacing and taller lines,
 *    links underlined so they are not mistaken for body text, and larger type.
 *  - none: exactly what the page shipped with.
 */
export const MODE_BUNDLES: Record<Mode, Bundle> = {
  blind: {
    dyslexia: false,
    textScale: 'larger',
    underlineLinks: true,
    highContrast: true,
    reduceMotion: true,
  },
  dyslexia: {
    dyslexia: true,
    textScale: 'larger',
    underlineLinks: true,
    highContrast: false,
    reduceMotion: false,
  },
  none: {
    dyslexia: false,
    textScale: 'normal',
    underlineLinks: false,
    highContrast: false,
    reduceMotion: false,
  },
};

export const DEFAULT_SETTINGS: AccessibilitySettings = {
  mode: 'none',
  ...MODE_BUNDLES.none,
};

/** Bumped only when the stored shape changes incompatibly. */
const STORAGE_KEY = 'earth-analogs.accessibility.v1';

/** Root sizes for the three steps. The interface is rem-based, so type scales. */
const ROOT_SIZE: Record<TextScale, string> = {
  normal: '16px',
  large: '17.5px',
  larger: '19px',
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const asBool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/** Reads the stored record, falling back to the defaults record by record. */
export function loadSettings(): AccessibilitySettings {
  const fallback: AccessibilitySettings = {
    ...DEFAULT_SETTINGS,
    reduceMotion: prefersReducedMotion(),
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    const value = parsed as Record<string, unknown>;
    const scale = value.textScale;
    const textScale = TEXT_SCALES.includes(scale as TextScale)
      ? (scale as TextScale)
      : 'normal';
    const dyslexia = asBool(value.dyslexia, fallback.dyslexia);
    // Records written before modes existed have no `mode` field. They keep
    // their look, and the label is inferred from the one feature that had a
    // name of its own.
    const stored = value.mode;
    const mode: Mode = MODES.includes(stored as Mode)
      ? (stored as Mode)
      : dyslexia
        ? 'dyslexia'
        : 'none';
    return {
      mode,
      dyslexia,
      textScale,
      underlineLinks: asBool(value.underlineLinks, fallback.underlineLinks),
      highContrast: asBool(value.highContrast, fallback.highContrast),
      reduceMotion: asBool(value.reduceMotion, fallback.reduceMotion),
    };
  } catch {
    return fallback;
  }
}

/** Returns false when the write failed (quota, private mode). */
export function saveSettings(settings: AccessibilitySettings): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/** Publishes the record to the document, where the CSS and the scenes read it. */
export function applySettings(settings: AccessibilitySettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.a11yMode = settings.mode;
  root.dataset.a11yDyslexia = settings.dyslexia ? 'on' : 'off';
  root.dataset.a11yLinks = settings.underlineLinks ? 'underline' : 'plain';
  root.dataset.a11yContrast = settings.highContrast ? 'on' : 'off';
  root.dataset.a11yMotion = settings.reduceMotion ? 'reduced' : 'full';
  root.dataset.a11yText = settings.textScale;
  root.style.fontSize = ROOT_SIZE[settings.textScale];
}

/** True when the reader asked for the text-first interface. */
export function blindMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.a11yMode === 'blind';
}

/**
 * True when motion should be suppressed: the OS setting or the in-app switch.
 * Read by the WebGL scenes, which build their own loops outside CSS reach, and
 * by the scroll-reveal / tilt enhancements.
 */
export function reducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    prefersReducedMotion() || document.documentElement.dataset.a11yMotion === 'reduced'
  );
}

/**
 * Reads, applies and persists the record. Applied inside the state initialiser
 * as well as the effect so a reload does not paint one frame at the defaults
 * before switching; the call is idempotent, which matters because StrictMode
 * runs the initialiser twice.
 */
export function useAccessibility() {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    const initial = loadSettings();
    applySettings(initial);
    return initial;
  });

  useEffect(() => {
    applySettings(settings);
    saveSettings(settings);
  }, [settings]);

  /** One click: the mode's bundle replaces whatever was applied before. */
  const choose = useCallback((mode: Mode) => {
    setSettings((current) =>
      mode === current.mode ? current : { mode, ...MODE_BUNDLES[mode] },
    );
  }, []);

  /** A fine-tune edit. It wins over the bundle but does not rename the mode. */
  const update = useCallback(
    <K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) => {
      setSettings((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  return { settings, choose, update };
}
