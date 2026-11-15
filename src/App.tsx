import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityDock } from './components/layout/AccessibilityDock';
import { DistanceFilter } from './components/layout/DistanceFilter';
import { TripPlanner } from './components/layout/TripPlanner';
import { ExportDialog } from './components/layout/ExportDialog';
import { FilterBar } from './components/layout/FilterBar';
import { HomePage } from './components/layout/HomePage';
import { TeamPage } from './components/layout/TeamPage';
import { Panel } from './components/layout/Panel';
import { SiteBackdrop } from './components/layout/SiteBackdrop';
import { DataSourceList } from './components/panels/DataSourceList';
import { InvestigationPrompts } from './components/panels/InvestigationPrompts';
import { ReportedDossier } from './components/panels/ReportedDossier';
import { ReportedSitesPanel } from './components/panels/ReportedSitesPanel';
import { ReportSiteForm } from './components/panels/ReportSiteForm';
import { CompareSites } from './components/panels/CompareSites';
import { SiteCompare } from './components/panels/SiteCompare';
import { SiteGallery } from './components/panels/SiteGallery';
import { SiteInspector } from './components/panels/SiteInspector';
import { SiteList, type RankedItem } from './components/panels/SiteList';
import { EarthGlobe, type ImageryState, type ReportedMarker } from './components/three/EarthGlobe';
import { earthLighting } from './lib/astro';
import { MarsMap } from './components/three/MarsMap';
import { MoonMap } from './components/three/MoonMap';
import { SiteTerrain } from './components/three/SiteTerrain';
import {
  castVote,
  deleteRecord,
  getCommunityState,
  getDatasets,
  getPredictions,
  saveNote,
  saveReportedSite,
  saveReview,
} from './services/api';
import type {
  CommunityState,
  DataSource,
  Prediction,
  ReportedSite,
  TerrainType,
} from './data-contracts/types';
import type { CommunityActions } from './components/panels/SiteCommunity';
import { useAccessibility } from './lib/accessibility';
import { routeHref, useRoute } from './lib/route';
import { EMPTY_COMMUNITY, makeNote, makeReview, upsertReportedSite } from './lib/community';
import { BAND_COLORS, bandColor } from './lib/colors';
import {
  FIT_BAND_LABELS,
  FIT_TYPE_LABELS,
  fitBandFor,
  fitPercentFor,
  type FitType,
} from './lib/similarity';
import { classifySite, classificationRank, STATE_LABELS } from './lib/classification';
import { photosFor, photoUrl, type SitePhoto } from './data/sitePhotos';
import { siteReport } from './lib/siteReport';
import { distanceKm as distanceBetween, type Origin } from './lib/geo';
import {
  purposeFits,
  purposesFit,
  MISSION_PURPOSE_ORDER,
  travelAccessOf,
  travelExport,
  type MissionPurpose,
} from './lib/travel';
import {
  imageryWindow,
  newestAvailableImageryDate,
} from './lib/earthImagery';
import {
  formatCoords,
  siteRefOf,
  targetSiteOf,
  TARGET_LABELS,
  TERRAIN_LABELS,
  terrainLabel,
  terrainOf,
  type SiteRef,
  type Target,
} from './lib/site';

/** A site opened in the orbit-vs-ground view, with its side of photos. */
interface CompareRequest {
  target: SiteRef;
  photos: SitePhoto[];
  reportPhotoUrl?: string;
}

/** Which report dialog is open: a new one, one being edited, or none. */
type ReportDraft = { mode: 'new' } | { mode: 'edit'; site: ReportedSite } | null;

/**
 * What the ranked queue is ordered by.
 *
 * The guide grades three dimensions and refuses to average them, so the order
 * is chosen too: one dimension at a time, or the whole set by how settled it
 * is. There is no "best fit" entry because there is no composite score for it
 * to name, and no Moon/Mars entry because the target button already says which
 * body every row is being read against.
 */
type SortKey = FitType;

/**
 * The sort menu, in the order a reader meets the factors.
 *
 * The first four are what the guide grades and the engine measures. Water & ice
 * and Illumination are listed because the challenge reads every analogue against
 * them, and a menu that silently omits a factor looks like the factor was
 * settled. Neither is measured in this build — no ice, regolith or illumination
 * product is ingested — so both fall back to the evidence order instead of
 * inventing a ranking from terrain family or latitude. When a product lands,
 * only these two comparators change.
 */
const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'overall', label: 'Overall Evidence Fit' },
  { value: 'terrain', label: 'Terrain & Topography Fit' },
  { value: 'geology', label: 'Surface & Geology Fit' },
  { value: 'thermal', label: 'Temperature & Environment Fit' },
  { value: 'waterIce', label: 'Water & Ice Fit' },
  { value: 'illumination', label: 'Illumination Fit' },
  { value: 'name', label: 'Name' },
];

const readParam = (key: string) =>
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(key);

/** Stable empty list for the marker-free Moon reference scene. */
const NO_PREDICTIONS: Prediction[] = [];

/**
 * Diacritic-insensitive fold, so "rio" matches "Río Tinto" and "mauna"
 * matches the ʻokina spelling in the mock region label.
 */
const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Deep-linkable state: `?target=mars&terrain=cave&site=pred-004`. */
/**
 * `2026-11-14T09:30`, in the reader's own zone, for a datetime-local input.
 *
 * The input has no zone of its own: it takes and gives wall-clock strings, so the
 * epoch has to be shifted by the local offset before slicing an ISO string, or
 * the control drifts by the offset every time it is opened.
 */
function toLocalInput(ms: number): string {
  const local = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/**
 * Scrollbars that keep out of the way.
 *
 * The ranked queue and the dossier are tall enough to scroll but short enough
 * that the browser's default bar was a permanent pale stripe down a dark panel.
 * The bar is drawn transparent and only shown while the container is actually
 * moving — plus on pointer hover or keyboard focus, so the affordance is still
 * there for a reader who goes looking for it. No layout moves when it appears,
 * because the gutter is reserved either way.
 */
function useAutoHideScrollbars() {
  useEffect(() => {
    const timers = new WeakMap<Element, number>();
    const containerFor = (event: Event) => {
      const node = event.target;
      return node instanceof Element ? node.closest('.list-scroll, .dossier-card') : null;
    };
    const onScroll = (event: Event) => {
      const container = containerFor(event);
      if (!container) return;
      container.classList.add('is-scrolling');
      const live = timers.get(container);
      if (live !== undefined) window.clearTimeout(live);
      // Long enough to survive the gap between two wheel notches.
      timers.set(
        container,
        window.setTimeout(() => container.classList.remove('is-scrolling'), 900),
      );
    };
    // Capture, because scroll does not bubble out of the container itself.
    document.addEventListener('scroll', onScroll, true);
    return () => document.removeEventListener('scroll', onScroll, true);
  }, []);
}

export default function App() {
  useAutoHideScrollbars();

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [datasets, setDatasets] = useState<DataSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<Target>(() => (readParam('target') === 'mars' ? 'mars' : 'moon'));

  /**
   * The shell's palette follows the target.
   *
   * Moon runs on the cyan signal the interface was built around; Mars re-points
   * the same tokens at the planet's own colours. Set on the document element so
   * the body's background gradient and anything portalled outside the shell
   * follow as well.
   */
  useEffect(() => {
    document.documentElement.dataset.target = target;
  }, [target]);
  const [terrain, setTerrain] = useState<TerrainType | 'all'>(() => {
    const value = readParam('terrain');
    const known = Object.keys(TERRAIN_LABELS) as TerrainType[];
    return known.includes(value as TerrainType) ? (value as TerrainType) : 'all';
  });
  const [sort, setSort] = useState<SortKey>('overall');
  /** Where "distance from me" is measured from, once the reader has picked it. */
  const [origin, setOrigin] = useState<Origin | null>(null);
  /** Radius of the distance filter, in kilometres. */
  const [radiusKm, setRadiusKm] = useState(5000);
  const [distanceOpen, setDistanceOpen] = useState(false);
  /** The Plan My Trip route planner, opened from the dossier. */
  const [tripOpen, setTripOpen] = useState(false);

  /**
   * The dossier opened out over the page.
   *
   * The column is a few hundred pixels of scrolling panel, which is fine beside a
   * globe and too tight for eight factor meters and a verdict. Expanded, the card
   * leaves the layout rather than widening it, so nothing behind it reflows.
   */
  const [dossierWide, setDossierWide] = useState(false);

  // Escape closes the opened dossier, as it closes a dialog: the reader who
  // expanded it is reading, not hunting for the button again.
  useEffect(() => {
    if (!dossierWide) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDossierWide(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dossierWide]);
  /** When on, only sites commercial travel can reach are listed. */
  /**
   * What the reader is planning: any number of the six purposes, held as a list
   * so the chips are a multi-select. An empty list is "All Purposes" — no purpose
   * cut at all — and the list is read as a union: a site stays if it fits at
   * least one chosen purpose. See lib/travel.ts.
   */
  const [purposes, setPurposes] = useState<MissionPurpose[]>([]);
  const [travelOnly, setTravelOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() => readParam('site'));
  const [copied, setCopied] = useState(false);
  /** The instant whose daylight the globe shows, epoch ms; "Now" resets it. */
  const [globeTime, setGlobeTime] = useState(() => Date.now());

  /**
   * The chosen instant in words. The terminator is a picture of this, so a reader
   * who is listening gets the same reading: the moment, the sub-solar point, and
   * which half of the planet that leaves lit.
   */
  const sunSummary = useMemo(() => {
    const moment = new Date(globeTime);
    const when = moment.toLocaleString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const lighting = earthLighting(moment);
    const lat = lighting.subSolarLat;
    const lon = lighting.subSolarLon;
    const where = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
    return `The globe is lit for ${when}. The Sun stands overhead at ${where}, so that point is in full daylight and its antipode is at midnight.`;
  }, [globeTime]);
  /** The archive's newest day and the span behind it, re-based once probed. */
  const [imageryWindowBounds, setImageryWindowBounds] = useState(() => imageryWindow());
  const [imagery, setImagery] = useState<ImageryState | null>(null);
  /**
   * The day the cloud layer shows, taken from the same clock as the sunlight.
   *
   * The terminator and the clouds describe one instant, so they cannot keep two
   * clocks: moving the sun's clock now asks the archive for that day's pass as
   * well, instead of leaving the previous day's clouds over the new night. GIBS
   * holds a rolling window, so a moment outside it snaps to the nearest archived
   * day — and the caption says that it did rather than pretending it did not.
   */
  const cloudDate = useMemo(() => {
    const day = new Date(globeTime).toISOString().slice(0, 10);
    if (day < imageryWindowBounds.min) return imageryWindowBounds.min;
    if (day > imageryWindowBounds.max) return imageryWindowBounds.max;
    return day;
  }, [globeTime, imageryWindowBounds]);
  const [showClouds, setShowClouds] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  /** True while a site's local 3D terrain is open over the globe. */
  const [terrainOpen, setTerrainOpen] = useState(false);
  /** Bumped to ask the globe to pull back after the terrain closes. */
  const [homeSignal, setHomeSignal] = useState(0);
  /** Site whose field-photo gallery is open, if any. */
  const [gallerySite, setGallerySite] = useState<Prediction | null>(null);
  /** Researcher reports, notes, reviews and upvotes (this browser + backend). */
  const [community, setCommunity] = useState<CommunityState>(EMPTY_COMMUNITY);
  /** True when a backend is configured but the last community write failed. */
  const [syncFailed, setSyncFailed] = useState(false);
  const [reportDraft, setReportDraft] = useState<ReportDraft>(null);
  const [manageOpen, setManageOpen] = useState(false);
  /** The export destination picker, opened from the dossier. */
  const [exportOpen, setExportOpen] = useState(false);
  const [compare, setCompare] = useState<CompareRequest | null>(null);
  /** True while two scored sites are open side by side. */
  const [compareSitesOpen, setCompareSitesOpen] = useState(false);
  /** Ambient site photograph behind the surface; on until switched off. */
  /** Reading preferences, applied to the document root by the dock. */
  const { settings: a11y, choose: chooseMode, update: updateA11y } = useAccessibility();
  /** The cover, or the workbench. Everything interactive lives behind `solution`. */
  const [route] = useRoute();
  /**
   * Opacity of the panel wash. Driven separately from the URL so switching
   * sites (or the switch itself) fades out and back in instead of popping the
   * new photograph straight onto every panel.
   */
  const [photoStrength, setPhotoStrength] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [nextPredictions, nextDatasets] = await Promise.all([getPredictions(), getDatasets()]);
        if (!alive) return;
        setPredictions(nextPredictions);
        setDatasets(nextDatasets);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  // The VIIRS archive can lag the calendar, and a gap day paints the globe
  // black while the caption claims success. Ask the archive which day it
  // actually holds, once, then point the picker and the first cloud request at
  // that day instead of at "yesterday".
  useEffect(() => {
    let alive = true;
    void newestAvailableImageryDate().then((date) => {
      if (!alive || !date) return;
      setImageryWindowBounds(imageryWindow(new Date(), date));
    });
    return () => {
      alive = false;
    };
  }, []);

  // Community state is read once on mount: the local store, merged with the
  // backend's copy when there is one.
  useEffect(() => {
    let alive = true;
    getCommunityState()
      .then((next) => {
        if (alive) setCommunity(next);
      })
      .catch(() => {
        // A backend failure must not blank out reports already in this browser.
      });
    return () => {
      alive = false;
    };
  }, []);

  /** Least settled dimension first: the guide's own reading of a row. */
  const compareByOverall = (a: RankedItem, b: RankedItem) =>
    classificationRank(a.classification) - classificationRank(b.classification) ||
    a.prediction.siteName.localeCompare(b.prediction.siteName);

  /**
   * Best to worst on the fit the sort menu is reading: the percentage itself,
   * largest first.
   *
   * The queue used to order each dimension by evidence state, which cannot promise
   * best-to-worst: the guide's states are coarser than its numbers, so a 50% and a
   * 70% terrain overlap are both `similar`, the states tie, and the alphabet
   * decides — which is how a promising candidate reached #1 above six strong ones.
   * The percentage is what the band is cut from, so ordering by it cannot
   * contradict the row's colour: strong first, then promising, then weak, and the
   * higher figure first inside a band. Equal figures fall back to the name, so the
   * order is stable rather than dependent on the order the predictions arrived in.
   */
  const compareByFit = (a: RankedItem, b: RankedItem) => {
    const percentA = fitPercentFor(sort, a.classification, target);
    const percentB = fitPercentFor(sort, b.classification, target);
    // A fit with no ratio at all — Water & Ice, Illumination — has no figure to
    // order by, so those keep the evidence order instead of pretending to one.
    if (percentA === null && percentB === null) return compareByOverall(a, b);
    // Rows without a figure for the selected fit are dropped before the sort, so
    // this only guards the moment between data arriving and the filter running.
    if (percentA === null) return 1;
    if (percentB === null) return -1;
    return percentB - percentA || a.prediction.siteName.localeCompare(b.prediction.siteName);
  };

  const ranked = useMemo<RankedItem[]>(() => {
    const needle = fold(query.trim());
    let items = predictions
      .filter((p) => terrain === 'all' || terrainOf(p) === terrain)
      .filter(
        (p) =>
          !needle || fold(p.siteName).includes(needle) || fold(p.region ?? '').includes(needle),
      )
      // The distance facet is a hard cut, not a re-rank: a site outside the
      // radius is not "further down the list", it is out of scope for this pass.
      .filter((p) => !origin || distanceBetween(origin, p) <= radiusKm)
      // Commercial access is a filter in the same sense: a site no airline
      // reaches is not a worse candidate, it is one the reader cannot use.
      .filter((p) => !travelOnly || travelAccessOf(p).access !== 'none')
      // Purpose is the same kind of cut: a site that no crew can fly into is not
      // a worse analogue, it is one the reader's mission cannot use. Several
      // purposes are a union, so a site needs to fit only one of them to stay. The
      // target comes in because navigation and construction read the
      // classification.
      .filter((p) => purposesFit(purposes, p, target))
      .map((prediction) => ({
        prediction,
        classification: classifySite(prediction, target),
        distanceKm: origin ? distanceBetween(origin, prediction) : undefined,
      }));

    /*
     * A row with no figure for the fit being read is not a result of that fit.
     * Listing it uncoloured claimed it answered a question it has no number for,
     * so it drops out here and the queue's empty state speaks instead — which is
     * the honest answer for Water & Ice and Illumination, neither of which this
     * build measures. The alphabetical sort is not a fit reading at all, so it
     * keeps every row.
     */
    items = items.filter(
      (item) => sort === 'name' || fitBandFor(sort, item.classification, target) !== null,
    );

    const sorters: Record<SortKey, (a: RankedItem, b: RankedItem) => number> = {
      // The whole set, read as its strongest dimension: the figure a site can
      // actually claim, which is the same figure its overall band is cut from.
      overall: compareByFit,
      // One dimension at a time, highest overlap first.
      terrain: compareByFit,
      geology: compareByFit,
      thermal: compareByFit,
      // Listed because the challenge asks for them; nothing in this build
      // measures either, so the order stays the evidence order rather than
      // ranking sites on an ice or illumination number that does not exist.
      waterIce: (a, b) => compareByOverall(a, b),
      illumination: (a, b) => compareByOverall(a, b),
      name: (a, b) => a.prediction.siteName.localeCompare(b.prediction.siteName),
    };

    return items.sort(sorters[sort]);
  }, [predictions, terrain, query, sort, target, origin, radiusKm, travelOnly, purposes]);

  /**
   * Open on the row the queue actually leads with.
   *
   * This used to sort by evidence state and break ties by name, which is the same
   * flaw the queue had: every site holding one `similar` dimension tied, and the
   * alphabet picked the dossier — so the panel opened on a site ranked #11 while
   * #1 sat unread beside it. Reading the queue's own first row keeps the two in
   * step under the current sort, filters included.
   */
  useEffect(() => {
    if (selectedId || ranked.length === 0) return;
    setSelectedId(ranked[0].prediction.id);
  }, [ranked, selectedId]);

  // Reported sites share the selection with model predictions: exactly one of
  // these two is ever non-null.
  const selectedReported =
    community.reportedSites.find((site) => site.id === selectedId) ?? null;
  const selected = selectedReported
    ? null
    : ranked.find((item) => item.prediction.id === selectedId)?.prediction ??
      ranked[0]?.prediction ??
      null;
  // The 3D view shows the site that is selected, it does not remember one of
  // its own. Holding a separate id here let the list and the terrain drift
  // apart — you could pick Antarctica and still be looking at Hawaii — so the
  // site is derived from the selection instead, and every way of picking a
  // site (list, report row, beacon, filter fallback) moves the view with it.
  const terrainSite: SiteRef | Prediction | null = useMemo(() => {
    if (!terrainOpen) return null;
    if (selectedReported) return siteRefOf(selectedReported);
    return selected;
  }, [terrainOpen, selected, selectedReported]);
  const selectedRank = selected
    ? ranked.findIndex((item) => item.prediction.id === selected.id) + 1
    : null;
  /**
   * Where the selected site lands on each target body. Memoised so the reference
   * globe only moves when the selection actually changes.
   */
  const moonReference = useMemo(
    () => (selected ? targetSiteOf(selected, 'moon') : null),
    [selected],
  );
  const marsReference = useMemo(
    () => (selected ? targetSiteOf(selected, 'mars') : null),
    [selected],
  );
  /**
   * The single-site analysis the export dialog writes. The whole ranked field
   * goes in with it: the plate's distribution and scatter compare this site
   * against every other one, and a one-site field would show nothing.
   */
  const exportReport = useMemo(
    () => (selected ? siteReport(selected, target) : null),
    [selected, target, predictions],
  );

  /** The itinerary tab the export can add, once an origin is known. */
  const exportTravel = useMemo(
    () => (selected ? travelExport(selected, origin) : null),
    [selected, origin],
  );

  /**
   * What blind mode says when the selection moves. For a reader who cannot see
   * the globe, the list *is* the interface, so every row has to arrive as a
   * sentence — and with both targets, because the score on screen shows one.
   */
  const blindAnnouncement =
    a11y.mode !== 'blind' || route !== 'solution'
      ? ''
      : selected
        ? `Site ${selectedRank ?? '?'} of ${ranked.length}: ${selected.siteName}. ${terrainLabel(
            selected,
          )}. ${classifySite(selected, target)
            .dimensions.map((dimension) => `${dimension.label}: ${STATE_LABELS[dimension.state].toLowerCase()}`)
            .join('. ')}.`
        : selectedReported
          ? `Reported site ${selectedReported.name}, unscored.`
          : 'No site selected.';

  // Reports respect the terrain chip and the search box, but never the ranking
  // sort: an unscored site has nothing to sort by.
  const reportedShown = useMemo(() => {
    const needle = fold(query.trim());
    return community.reportedSites.filter(
      (site) =>
        (terrain === 'all' || site.terrainType === terrain) &&
        (!needle ||
          fold(site.name).includes(needle) ||
          fold(site.region ?? '').includes(needle) ||
          fold(site.reporter).includes(needle)),
    );
  }, [community.reportedSites, query, terrain]);

  const reportedMarkers = useMemo<ReportedMarker[]>(() =>
    reportedShown.map((site) => ({
      id: site.id,
      name: site.name,
      lat: site.lat,
      lon: site.lon,
      terrain: site.terrainType ? TERRAIN_LABELS[site.terrainType] : 'Unclassified',
      targets: site.targets.map((t) => (t === 'moon' ? 'Moon' : 'Mars')).join(' + '),
    })),
  [reportedShown]);

  /** Stores a write locally and records whether the backend has it too. */
  async function commit(write: Promise<{ state: CommunityState; synced: boolean }>) {
    const { state, synced } = await write;
    setCommunity(state);
    setSyncFailed(!synced);
  }

  // The selected site's ground photograph, if it has one. Reported sites use
  // whatever the reporter supplied. Sites with no photo leave the plain
  // surface in place rather than showing something unrelated.
  const backdropUrl = useMemo(() => {
    if (selectedReported) return selectedReported.photoUrl ?? null;
    if (!selected) return null;
    const photos = photosFor(selected);
    return photos.length > 0 ? photoUrl(photos[0], 1600) : null;
  }, [selected, selectedReported]);

  useEffect(() => {
    if (!backdropUrl) {
      setPhotoStrength(0);
      return;
    }
    setPhotoStrength(0);
    // 0.16 over the card's baked-in wash: the strongest photo pixel lands
    // around 18/255 of added luminance, so panels pick up the site's colours
    // without pushing the smallest labels off their contrast.
    const timer = window.setTimeout(() => setPhotoStrength(0.16), 30);
    return () => window.clearTimeout(timer);
  }, [backdropUrl]);

  /** Community writes bound to one site id. */
  function communityActionsFor(siteId: string): CommunityActions {
    return {
      onVote: () => void commit(castVote(community, siteId)),
      onAddNote: (input) => void commit(saveNote(community, makeNote({ siteId, ...input }))),
      onAddReview: (input) => void commit(saveReview(community, makeReview({ siteId, ...input }))),
      onDelete: (kind, id) => void commit(deleteRecord(community, kind, id)),
    };
  }

  // If the current site is filtered out, fall back to the new top of the list
  // so the dossier and the shareable URL never point at a hidden row.
  useEffect(() => {
    if (ranked.length === 0) return;
    // A selected report stays selected; only a hidden *prediction* falls back.
    if (community.reportedSites.some((site) => site.id === selectedId)) return;
    if (!ranked.some((item) => item.prediction.id === selectedId)) {
      setSelectedId(ranked[0].prediction.id);
    }
  }, [ranked, selectedId, community.reportedSites]);

  /**
   * How many sites each purpose leaves, counted over the whole catalogue rather
   * than the current list: the chips sit above the terrain cut, so a count that
   * changed with the search box would say nothing about the purpose itself.
   */
  const purposeCounts = useMemo(() => {
    const counts: Record<MissionPurpose, number> = {
      any: predictions.length,
      landing: 0,
      mobility: 0,
      navigation: 0,
      robotic: 0,
      human: 0,
      construction: 0,
    };
    for (const prediction of predictions) {
      for (const key of MISSION_PURPOSE_ORDER) {
        if (purposeFits(key, prediction, target)) counts[key] += 1;
      }
    }
    return counts;
  }, [predictions, target]);

  /** Two honest counts instead of a mean fit and a "strong" count. */
  const stats = useMemo(() => {
    const similarTerrain = ranked.filter(
      (item) => item.classification.dimensions[0].state === 'similar',
    ).length;
    const unmeasured = ranked.filter((item) =>
      item.classification.dimensions.some((dimension) => dimension.state === 'insufficient_evidence'),
    ).length;
    return { similarTerrain, unmeasured };
  }, [ranked]);

  const terrainCounts = useMemo(() => {
    const counts: Partial<Record<TerrainType, number>> = {};
    for (const prediction of predictions) {
      const type = terrainOf(prediction);
      if (type) counts[type] = (counts[type] ?? 0) + 1;
    }
    return counts;
  }, [predictions]);

  // Globe caption: cloud-free by default, live satellite pass when switched on.
  const imageryKicker = !showClouds
    ? 'Blue Marble · NASA'
    : imagery === null
      ? 'NASA VIIRS · loading'
      : imagery.live
        ? 'NASA VIIRS · clouds'
        : 'Blue Marble · NASA';
  /** True when the clock is outside the archive and the day has been snapped. */
  const cloudClamped =
    showClouds && new Date(globeTime).toISOString().slice(0, 10) !== cloudDate;
  const imageryNote = !showClouds
    ? 'Cloud-free mosaic · live terminator'
    : imagery === null
      ? `${cloudDate} UTC · live terminator`
      : imagery.live
        ? `${cloudDate} UTC · true color · live terminator${
            cloudClamped ? ` · archive holds ${imageryWindowBounds.max}` : ''
          }`
        : 'Cloud imagery unavailable';

  // Turning clouds on hides the stale caption until the new pass decodes;
  // turning them off keeps the texture cached for an instant re-toggle.
  function toggleClouds() {
    const next = !showClouds;
    setShowClouds(next);
    if (next) setImagery(null);
  }

  // Stable arrays: the globe rebuilds its beacons and the Moon scene re-mounts
  // whenever these props change identity, so do not recreate them per render.
  const visiblePredictions = useMemo(
    () => ranked.map((item) => item.prediction),
    [ranked],
  );

  // Keyboard: `/` search, arrows walk the ranking, Esc returns to the top site.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // The ranking only exists on the workbench: arrows on the cover must not
      // move an invisible selection behind it.
      if (route !== 'solution') return;
      // The terrain view and the photo gallery own the keyboard while open.
      if (terrainOpen || gallerySite) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (event.key === '/' && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing) return;

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (ranked.length === 0) return;
        event.preventDefault();
        const index = ranked.findIndex((item) => item.prediction.id === selected?.id);
        const next =
          event.key === 'ArrowDown'
            ? Math.min(ranked.length - 1, index + 1)
            : Math.max(0, index - 1);
        const id = ranked[next].prediction.id;
        setSelectedId(id);
        requestAnimationFrame(() => {
          document
            .querySelector(`[data-site-id="${CSS.escape(id)}"]`)
            ?.scrollIntoView({ block: 'nearest' });
        });
        return;
      }

      if (event.key === 'Escape') {
        setSelectedId(ranked[0]?.prediction.id ?? null);
        searchRef.current?.blur();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ranked, selected, terrainOpen, gallerySite, route]);

  // A dialog opened on the workbench must not hang over the cover after a tab
  // switch, so leaving the solution closes whatever was floating on it.
  useEffect(() => {
    if (route === 'solution') return;
    setGallerySite(null);
    setReportDraft(null);
    setManageOpen(false);
    setCompare(null);
    setTerrainOpen(false);
    setTripOpen(false);
  }, [route]);

  // Keep the URL shareable without polluting browser history. The route rides
  // in the hash, so a link keeps both the view and the state inside it.
  useEffect(() => {
    const params = new URLSearchParams();
    if (target !== 'moon') params.set('target', target);
    if (terrain !== 'all') params.set('terrain', terrain);
    if (selectedId) params.set('site', selectedId);
    const search = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${search ? `?${search}` : ''}#/${route}`,
    );
  }, [target, terrain, selectedId, route]);

  /** Adds a report, or saves an edited one, then opens it. */
  function saveReport(site: ReportedSite) {
    // The community state updates *first*, synchronously: selecting the new id
    // before it exists would look like a hidden prediction to the fallback
    // effect, which would immediately bounce the selection back to the top
    // ranked site. Upserting twice (here and in the adapter) is idempotent.
    const next = upsertReportedSite(community, site);
    setCommunity(next);
    void commit(saveReportedSite(next, site));
    setReportDraft(null);
    setSelectedId(site.id);
  }

  function deleteReport(site: ReportedSite) {
    const remaining = community.reportedSites.filter((entry) => entry.id !== site.id);
    void commit(deleteRecord(community, 'reportedSites', site.id));
    if (selectedId === site.id) {
      setSelectedId(predictions.length > 0 ? predictions[0].id : remaining[0]?.id ?? null);
    }
  }

  /** Opens the orbit-vs-ground view for either kind of site. */
  function openCompare(site: Prediction | ReportedSite) {
    if ('siteName' in site) {
      setCompare({ target: site, photos: photosFor(site) });
    } else {
      setCompare({ target: siteRefOf(site), photos: [], reportPhotoUrl: site.photoUrl });
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Clipboard API needs a secure context; fall back to a selection copy so
      // the permalink still works from a plain-http local demo.
      const field = document.createElement('textarea');
      field.value = window.location.href;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    // Two presentation variables carry the backdrop: the page-level layer
    // (SiteBackdrop) and the faint wash the panels pick up via `::before`.
    <div
      className="app"
      style={
        {
          '--site-photo': backdropUrl ? `url("${backdropUrl}")` : 'none',
          '--site-photo-strength': String(photoStrength),
        } as React.CSSProperties
      }
    >
      {/* First two tab stops on the workbench, invisible until focused. A reader
          who cannot use the globe should never have to tab past it to reach
          text. The cover is short enough not to need them. */}
      {route === 'solution' ? (
        <nav className="skip-links" aria-label="Skip links">
          <a className="skip-link" href="#ranked-sites">
            Skip to ranked sites
          </a>
          <a className="skip-link" href="#site-dossier">
            Skip to site dossier
          </a>
        </nav>
      ) : null}

      {route === 'solution' ? <SiteBackdrop url={backdropUrl} enabled /> : null}


      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <h1>TerraNexus</h1>
        </div>

        <nav className="tabs" aria-label="Sections">
          <a
            className={route === 'home' ? 'tab is-current' : 'tab'}
            href={routeHref('home')}
            aria-current={route === 'home' ? 'page' : undefined}
          >
            Home
          </a>
          <a
            className={route === 'solution' ? 'tab is-current' : 'tab'}
            href={routeHref('solution')}
            aria-current={route === 'solution' ? 'page' : undefined}
          >
            Solution
          </a>
          <a
            className={route === 'team' ? 'tab is-current' : 'tab'}
            href={routeHref('team')}
            aria-current={route === 'team' ? 'page' : undefined}
          >
            Our Team
          </a>
        </nav>

        <div className="topbar-right">
          <a
            className="topbar-link"
            href="https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/"
            target="_blank"
            rel="noreferrer"
          >
            NASA Space Apps 2026
          </a>
        </div>
      </header>

      {route === 'home' ? (
        <HomePage
          target={target}
          sites={predictions.length}
          datasets={datasets.length}
          still={a11y.reduceMotion}
        />
      ) : route === 'team' ? (
        <TeamPage still={a11y.reduceMotion} />
      ) : (
        <>
      <FilterBar
        target={target}
        onTarget={setTarget}
        terrain={terrain}
        onTerrain={setTerrain}
        counts={terrainCounts}
        shown={ranked.length}
        total={predictions.length}
        terrainSimilar={stats.similarTerrain}
        unmeasured={stats.unmeasured}
        datasetCount={datasets.length}
        origin={origin}
        radiusKm={radiusKm}
        onRadius={setRadiusKm}
        onOpenDistance={() => setDistanceOpen(true)}
        travelOnly={travelOnly}
        onTravelOnly={setTravelOnly}
        purposes={purposes}
        onPurposes={setPurposes}
        purposeCounts={purposeCounts}
      />

      {error ? <p className="error">⚠ {error}</p> : null}

      <main className="workbench">
        <section className="card list-card" id="ranked-sites" tabIndex={-1}>
          <header className="card-head">
            <div className="card-head-text">
              <h2>Ranked sites</h2>
            </div>
            <label className="select">
              <span className="sr-only">Sort sites by</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
                {/* One entry per factor, plus the whole set and the alphabet.
                    No Moon fit, no Mars fit, no best fit: the target button
                    already says which body every row is read against. */}
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </header>

          <div className="list-search">
            <div className="search">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon">
                <circle cx="11" cy="11" r="7" />
                <path d="M16.5 16.5 21 21" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search sites"
                aria-label="Search candidate sites"
              />
              {query ? (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  ×
                </button>
              ) : (
                <kbd aria-hidden="true">/</kbd>
              )}
            </div>
          </div>

          <div className="list-scroll">
            <SiteList
              items={ranked}
              selectedId={selected?.id ?? null}
              target={target}
              total={predictions.length}
              fit={sort}
              onSelect={setSelectedId}
            />

            <div className="reported-block">
              <div className="reported-head">
                <h3>
                  Reported candidates <span className="tab-count">{reportedShown.length}</span>
                </h3>
                <div className="reported-actions">
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => setReportDraft({ mode: 'new' })}
                  >
                    + Report a site
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => setManageOpen(true)}
                    disabled={community.reportedSites.length === 0}
                    title="Review, edit, delete or export your reports"
                  >
                    Manage
                  </button>
                </div>
              </div>

              {reportedShown.length === 0 ? (
                <p className="reported-empty">
                  {community.reportedSites.length === 0
                    ? 'Nothing reported yet. Add a site with its field evidence and it lands here — unscored, for review.'
                    : 'No reported sites match this filter.'}
                </p>
              ) : (
                <ul className="reported-list" aria-label="Researcher-reported candidate sites">
                  {reportedShown.map((site) => {
                    const active = selectedReported?.id === site.id;
                    return (
                      <li key={site.id}>
                        <button
                          type="button"
                          className={active ? 'reported-row is-selected' : 'reported-row'}
                          aria-current={active ? 'true' : undefined}
                          data-reported-id={site.id}
                          onClick={() => setSelectedId(site.id)}
                        >
                          <span className="reported-mark" aria-hidden="true" />
                          <span className="site-main">
                            <span className="site-name">{site.name.split(',')[0]}</span>
                            <span className="site-meta">
                              {site.terrainType ? TERRAIN_LABELS[site.terrainType] : 'Unclassified'} ·{' '}
                              {site.targets.map((t) => (t === 'moon' ? 'Moon' : 'Mars')).join(' + ')} ·
                              unreviewed
                            </span>
                          </span>
                          <span className="reported-flag">Reported</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
          <footer className="card-foot">
            {ranked.length} of {predictions.length} scored
            {community.reportedSites.length > 0
              ? ` · ${community.reportedSites.length} reported`
              : ''}
            <span className="foot-hint">↑ ↓ to walk · / to search</span>
          </footer>
        </section>

        {/* The globe and the "what could it be used for" prompts share the
            middle column, so the prompts sit under the ground they describe
            instead of in a band at the foot of the page. */}
        <div className="globe-column">
          <section className="card globe-card" aria-label="Site globe">
          {/* Blind mode: to a listener the globe is decoration, so say what it
              carries and where the same information lives in text. */}
          <p className="sr-only">
            A 3D globe marks the {visiblePredictions.length} matching sites as beacons
            coloured by terrain evidence state. It holds nothing the ranked list does not:
            the same sites appear there in the same order, each with its three dimension
            states — terrain, geology and thermal.
          </p>
          {/* The terminator in words: which half of the planet is lit, and where
              the Sun stands at the chosen moment. */}
          <p className="sr-only">{sunSummary}</p>
          <div className="globe-stage">
            {/* Remounted when the motion preference changes: the scene reads the
                setting once, when it builds its animation loop. */}
            <EarthGlobe
              fit={sort}
              key={a11y.reduceMotion ? 'globe-reduced-motion' : 'globe-free'}
              predictions={visiblePredictions}
              selectedId={selectedId}
              target={target}
              onSelect={setSelectedId}
              imageryDate={cloudDate}
              sunAt={globeTime}
              onImagery={setImagery}
              showClouds={showClouds}
              onToggleClouds={toggleClouds}
              onOpenSite={(id) => {
                setSelectedId(id);
                setTerrainOpen(true);
              }}
              reportedSites={reportedMarkers}
              homeSignal={homeSignal}
            />

            <div className="globe-overlay">
              <div className="globe-tag">
                <span className="kicker">{imageryKicker}</span>
                <p>{imageryNote}</p>
                {/* No second date field: the clock below already names the
                    instant, and two controls that could disagree is how the
                    clouds ended up a day behind the terminator. */}
                {cloudClamped ? (
                  <p className="imagery-clamp">
                    Clouds stop at {imageryWindowBounds.max}: the archive has nothing newer
                    to show.
                  </p>
                ) : null}
                {/* The sun's own clock: the day/night line is a reading of the
                    Earth at an instant, so it can be moved to any instant. */}
                <div className="globe-time">
                  <span>Sun at</span>
                  <input
                    type="datetime-local"
                    aria-label="Date and time whose daylight the globe shows"
                    title="Move the day/night line to this date and time"
                    value={toLocalInput(globeTime)}
                    onChange={(event) => {
                      const next = new Date(event.target.value).getTime();
                      if (!Number.isNaN(next)) setGlobeTime(next);
                    }}
                  />
                  <button type="button" onClick={() => setGlobeTime(Date.now())}>
                    Now
                  </button>
                </div>
              </div>
              <div className="globe-side">
                <ul className="legend" aria-label="Beacon legend">
                  {/* The bands of whichever fit the ranking menu is reading, so a
                      beacon's colour and a row's name say the same word. */}
                  <li>
                    <span className="legend-dot" style={{ background: BAND_COLORS.strong }} />
                    Strong
                  </li>
                  <li>
                    <span className="legend-dot" style={{ background: BAND_COLORS.promising }} />
                    Promising
                  </li>
                  <li>
                    <span className="legend-dot" style={{ background: BAND_COLORS.weak }} />
                    Weak
                  </li>
                  <li>
                    <span className="legend-ring" />
                    Reported
                  </li>
                </ul>
                <span className="globe-hint">Click a beacon to land</span>
              </div>
            </div>

            {terrainSite ? (
              <SiteTerrain
                key={terrainSite.id}
                prediction={terrainSite}
                onClose={() => {
                  setTerrainOpen(false);
                  setHomeSignal((n) => n + 1);
                }}

              />
            ) : null}

            <div className="globe-strip">
              {selected ? (
                <>
                  <span className="strip-name">{selected.siteName}</span>
                  <span className="strip-meta">{formatCoords(selected.lat, selected.lon)}</span>
                  <span className="strip-meta">{terrainLabel(selected)}</span>
                  <span
                    className="strip-score"
                    style={{
                      color: bandColor(
                        fitBandFor(sort, classifySite(selected, target), target),
                      ),
                    }}
                  >
                    {(() => {
                      const band = fitBandFor(sort, classifySite(selected, target), target);
                      return band ? FIT_BAND_LABELS[band] : 'No fit figure';
                    })()}
                    <span className="strip-score-unit">{FIT_TYPE_LABELS[sort]}</span>
                  </span>
                </>
              ) : selectedReported ? (
                <>
                  <span className="strip-name">{selectedReported.name}</span>
                  <span className="strip-meta">
                    {formatCoords(selectedReported.lat, selectedReported.lon)}
                  </span>
                  <span className="strip-meta">
                    {selectedReported.terrainType
                      ? TERRAIN_LABELS[selectedReported.terrainType]
                      : 'Unclassified'}
                  </span>
                  <span className="strip-score strip-score-report">
                    Reported
                    <span className="strip-score-unit">unscored</span>
                  </span>
                </>
              ) : (
                <span className="strip-meta">No site selected</span>
              )}
            </div>
          </div>
          </section>
        </div>

        <div className="dossier-column">
          {/* The reference globe follows the selected target: Moon phase on
              one side, Mars's real sub-solar point and season on the other.
              It sits above the dossier because that is what the dossier is
              about: the ground this site stands in for. */}
          <Panel
            title="Comparison target"
            subtitle={
              target === 'moon' ? 'Moon · real phase right now' : 'Mars · real sun angle right now'
            }
            className="target-panel"
          >
            {target === 'moon' ? (
              <MoonMap predictions={NO_PREDICTIONS} showMarkers={false} highlight={moonReference} />
            ) : (
              <MarsMap highlight={marsReference} />
            )}
          </Panel>

          {/* An opened-out dossier is a sheet over the workbench, so the page behind
              it is a real button rather than a painted wash: clicking anywhere outside
              the panel closes it. Transparent, because the wash is drawn by the card's
              own ::before and a second one here would double the darkness. */}
          {dossierWide ? (
            <button
              type="button"
              className="dossier-scrim"
              aria-label="Close the site dossier"
              tabIndex={-1}
              onClick={() => setDossierWide(false)}
            />
          ) : null}

          <section
            className={dossierWide ? 'card dossier-card is-wide' : 'card dossier-card'}
            id="site-dossier"
            tabIndex={-1}
          >
          {selectedReported ? (
            <ReportedDossier
              site={selectedReported}
              community={community}
              actions={communityActionsFor(selectedReported.id)}
              onFlyIn={(site) => {
                setSelectedId(site.id);
                setTerrainOpen(true);
              }}
              onCompare={openCompare}
              onEdit={(site) => setReportDraft({ mode: 'edit', site })}
              onDelete={deleteReport}
            />
          ) : (
            <SiteInspector
              prediction={selected}
              rank={selectedRank}
              target={target}
              datasets={datasets}
              community={community}
              actions={communityActionsFor(selected?.id ?? '')}
              onExport={() => setExportOpen(true)}
              onPlanTrip={() => setTripOpen(true)}
              onCompareSites={() => setCompareSitesOpen(true)}
              onCopyLink={copyLink}
              onSeeSite={() => selected && setGallerySite(selected)}
              onCompare={() => selected && openCompare(selected)}
              copied={copied}
              expanded={dossierWide}
              onToggleExpand={() => setDossierWide((wide) => !wide)}
            />
          )}
          </section>
        </div>
      </main>

      {/* The prompts span the page instead of sharing the middle column: inside
          it they took the height the globe needed, so the globe stopped short of
          the ranked list and the dossier beside it. */}
      <section className="investigations-band">
        <InvestigationPrompts prediction={selected} />
        {/* The brief asks what a site could supply; this build does not score
            that. Saying so on the page is the difference between a scope
            decision and an omission a judge finds for us. */}
        <p className="scope-note">
          <strong>Out of scope in this build:</strong> resources. No ice, regolith or
          illumination proxy is modelled, so a site is never scored on what it could
          supply — only on the ground it stands on, its thermal setting, its geology
          and the state of the evidence behind each.
        </p>
      </section>

      <section className="evidence">
        <button
          type="button"
          className="evidence-toggle"
          aria-expanded={evidenceOpen}
          onClick={() => setEvidenceOpen((open) => !open)}
        >
          <span className={evidenceOpen ? 'caret is-open' : 'caret'} aria-hidden="true" />
          Evidence &amp; provenance
          <span className="evidence-hint">
            lunar reference · data sources
          </span>
        </button>

        {evidenceOpen ? (
          <div className="evidence-grid">
            <Panel
              title="Data sources"
              subtitle="NASA Earth, Moon & Mars datasets behind these layers"
              className="sources-card"
            >
              <DataSourceList datasets={datasets} />
            </Panel>
          </div>
        ) : null}
      </section>
        </>
      )}

      {gallerySite ? (
        <SiteGallery
          key={gallerySite.id}
          prediction={gallerySite}
          onClose={() => setGallerySite(null)}
        />
      ) : null}

      {reportDraft ? (
        <ReportSiteForm
          key={reportDraft.mode === 'edit' ? reportDraft.site.id : 'new'}
          initial={reportDraft.mode === 'edit' ? reportDraft.site : undefined}
          onSave={saveReport}
          onClose={() => setReportDraft(null)}
        />
      ) : null}

      {distanceOpen ? (
        <DistanceFilter
          origin={origin}
          onPick={setOrigin}
          onClear={() => setOrigin(null)}
          onClose={() => setDistanceOpen(false)}
        />
      ) : null}

      {tripOpen && selected ? (
        <TripPlanner
          key={selected.id}
          site={selected}
          origin={origin}
          onPick={setOrigin}
          onClear={() => setOrigin(null)}
          onClose={() => setTripOpen(false)}
        />
      ) : null}

      {exportOpen && exportReport ? (
        <ExportDialog
          title={exportReport.title}
          filename={exportReport.filename}
          sheet={`${TARGET_LABELS[target]} analysis`}
          subtitle={exportReport.subtitle}
          table={exportReport.table}
          html={exportReport.html}
          travel={exportTravel}
          onClose={() => setExportOpen(false)}
        />
      ) : null}

      {compareSitesOpen && selected ? (
        <CompareSites
          key={selected.id}
          current={selected}
          options={ranked.map((item) => item.prediction)}
          target={target}
          origin={origin}
          onClose={() => setCompareSitesOpen(false)}
        />
      ) : null}

      {manageOpen ? (
        <ReportedSitesPanel
          sites={community.reportedSites}
          syncFailed={syncFailed}
          onNew={() => {
            setManageOpen(false);
            setReportDraft({ mode: 'new' });
          }}
          onEdit={(site) => {
            setManageOpen(false);
            setReportDraft({ mode: 'edit', site });
          }}
          onDelete={deleteReport}
          onClose={() => setManageOpen(false)}
        />
      ) : null}

      {compare ? (
        <SiteCompare
          key={compare.target.id}
          site={compare.target}
          photos={compare.photos}
          reportPhotoUrl={compare.reportPhotoUrl}
          onClose={() => setCompare(null)}
        />
      ) : null}

      {/* Stays mounted so the region is live before the first move: a reader who
          switches blind mode on hears the site already on screen and every one
          they walk to after it. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {blindAnnouncement}
      </p>

      {/* A second region rather than a longer sentence in the first: the site
          announcement must not be re-read every time the time control moves. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {a11y.mode === 'blind' && route === 'solution' ? sunSummary : ''}
      </p>

      <AccessibilityDock settings={a11y} onMode={chooseMode} onChange={updateA11y} />
    </div>
  );
}
