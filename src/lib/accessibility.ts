/**
 * Reader accessibility preferences.
 *
 * One small, versioned record in `localStorage`, applied to the document as
 * data attributes and a root font size rather than through the component tree.
 * That is deliberate: the preferences have to reach things React does not
 * render — the WebGL scenes with their own animation loops, the CSS-only
 * backdrop wash — and a root attribute is the one place all of them can read.
 *
 * Reads are defensive in the same way `community.ts` is: a hand-edited or stale
 * entry falls back to the defaults instead of taking the page down. The OS
 * setting is honoured as the starting point, so a reader who has already asked
 * their machine for less motion is not made to ask twice.
 */

import { useCallback, useEffect, useState } from 'react';

export type TextScale = 'normal' | 'large' | 'larger';

export const TEXT_SCALES: readonly TextScale[] = ['normal', 'large', 'larger'];

export interface AccessibilitySettings {
  /** Lexend type, wider letter and word spacing, taller lines. */
  dyslexia: boolean;
  textScale: TextScale;
  underlineLinks: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
}

export const DEFAULT_SETTINGS: AccessibilitySettings = {
  dyslexia: false,
  textScale: 'normal',
  underlineLinks: false,
  highContrast: false,
  reduceMotion: false,
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
    return {
      dyslexia: asBool(value.dyslexia, fallback.dyslexia),
      textScale: TEXT_SCALES.includes(scale as TextScale) ? (scale as TextScale) : 'normal',
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
  root.dataset.a11yDyslexia = settings.dyslexia ? 'on' : 'off';
  root.dataset.a11yLinks = settings.underlineLinks ? 'underline' : 'plain';
  root.dataset.a11yContrast = settings.highContrast ? 'on' : 'off';
  root.dataset.a11yMotion = settings.reduceMotion ? 'reduced' : 'full';
  root.dataset.a11yText = settings.textScale;
  root.style.fontSize = ROOT_SIZE[settings.textScale];
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

  const update = useCallback(
    <K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) => {
      setSettings((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  return { settings, update, reset };
}
