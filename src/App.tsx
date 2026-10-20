import { useEffect, useMemo, useRef, useState } from 'react';
import { FeatureImportance } from './components/charts/FeatureImportance';
import { ScoreDistribution } from './components/charts/ScoreDistribution';
import { AccessibilityDock } from './components/layout/AccessibilityDock';
import { FilterBar } from './components/layout/FilterBar';
import { HomePage } from './components/layout/HomePage';
import { TeamPage } from './components/layout/TeamPage';
import { Panel } from './components/layout/Panel';
import { SiteBackdrop } from './components/layout/SiteBackdrop';
import { DataSourceList } from './components/panels/DataSourceList';
import { ReportedDossier } from './components/panels/ReportedDossier';
import { ReportedSitesPanel } from './components/panels/ReportedSitesPanel';
import { ReportSiteForm } from './components/panels/ReportSiteForm';
import { SiteCompare } from './components/panels/SiteCompare';
import { SiteGallery } from './components/panels/SiteGallery';
import { SiteInspector } from './components/panels/SiteInspector';
import { SiteList, type RankedItem } from './components/panels/SiteList';
import { EarthGlobe, type ImageryState, type ReportedMarker } from './components/three/EarthGlobe';
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
  usingMockData,
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
import { scoreColor } from './lib/colors';
import { photosFor, photoUrl, type SitePhoto } from './data/sitePhotos';
import { imageryWindow, latestImageryDate } from './lib/earthImagery';
import {
  fitFor,
  formatCoords,
  formatScore,
  siteRefOf,
  TERRAIN_LABELS,
  terrainLabel,
  terrainOf,
  toCsv,
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

type SortKey = 'fit' | 'moon' | 'mars' | 'name';

const readParam = (key: string) =>
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(key);

/** Stable empty list for the marker-free Moon reference scene. */
const NO_PREDICTIONS: Prediction[] = [];

/** The pickable span of NASA imagery days (UTC), computed once per session. */
const IMAGERY_WINDOW = imageryWindow();

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
export default function App() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [datasets, setDatasets] = useState<DataSource[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [target, setTarget] = useState<Target>(() => (readParam('target') === 'mars' ? 'mars' : 'moon'));
  const [terrain, setTerrain] = useState<TerrainType | 'all'>(() => {
    const value = readParam('terrain');
    const known = Object.keys(TERRAIN_LABELS) as TerrainType[];
    return known.includes(value as TerrainType) ? (value as TerrainType) : 'all';
  });
  const [sort, setSort] = useState<SortKey>('fit');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() => readParam('site'));
  const [copied, setCopied] = useState(false);
  const [imageryDate, setImageryDate] = useState(() => latestImageryDate());
  const [imagery, setImagery] = useState<ImageryState | null>(null);
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
  const [compare, setCompare] = useState<CompareRequest | null>(null);
  /** Ambient site photograph behind the surface; on until switched off. */
  const [backdrop, setBackdrop] = useState(true);
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

  // Open on the strongest site for the active target.
  useEffect(() => {
    if (selectedId || predictions.length === 0) return;
    const top = [...predictions].sort((a, b) => fitFor(b, target) - fitFor(a, target))[0];
    setSelectedId(top.id);
  }, [predictions, selectedId, target]);

  const ranked = useMemo<RankedItem[]>(() => {
    const needle = fold(query.trim());
    const items = predictions
      .filter((p) => terrain === 'all' || terrainOf(p) === terrain)
      .filter(
        (p) =>
          !needle || fold(p.siteName).includes(needle) || fold(p.region ?? '').includes(needle),
      )
      .map((prediction) => ({ prediction, fit: fitFor(prediction, target) }));

    const byFit = (t: Target) => (a: RankedItem, b: RankedItem) =>
      fitFor(b.prediction, t) - fitFor(a.prediction, t);

    const sorters: Record<SortKey, (a: RankedItem, b: RankedItem) => number> = {
      fit: byFit(target),
      moon: byFit('moon'),
      mars: byFit('mars'),
      name: (a, b) => a.prediction.siteName.localeCompare(b.prediction.siteName),
    };

    return items.sort(sorters[sort]);
  }, [predictions, terrain, query, sort, target]);

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
          )}. Moon fit ${formatScore(fitFor(selected, 'moon'))} of 1. Mars fit ${formatScore(
            fitFor(selected, 'mars'),
          )} of 1.`
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
    if (!backdrop || !backdropUrl) {
      setPhotoStrength(0);
      return;
    }
    setPhotoStrength(0);
    // 0.16 over the card's baked-in wash: the strongest photo pixel lands
    // around 18/255 of added luminance, so panels pick up the site's colours
    // without pushing the smallest labels off their contrast.
    const timer = window.setTimeout(() => setPhotoStrength(0.16), 30);
    return () => window.clearTimeout(timer);
  }, [backdrop, backdropUrl]);

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

  const stats = useMemo(() => {
    if (ranked.length === 0) return { meanFit: 0, strong: 0 };
    const meanFit = ranked.reduce((sum, item) => sum + item.fit, 0) / ranked.length;
    return { meanFit, strong: ranked.filter((item) => item.fit > 0.72).length };
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
  const imageryNote = !showClouds
    ? 'Cloud-free mosaic · live terminator'
    : imagery === null
      ? `${imageryDate} UTC · live terminator`
      : imagery.live
        ? `${imageryDate} UTC · true color · live terminator`
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

  function exportCsv() {
    const blob = new Blob([toCsv(ranked.map((item) => item.prediction), target)], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analog-sites-${target}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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

      {route === 'solution' ? <SiteBackdrop url={backdropUrl} enabled={backdrop} /> : null}

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
            Our team
          </a>
        </nav>

        <div className="topbar-right">
          {route === 'solution' ? (
            <>
              <button
                type="button"
                className={backdrop ? 'topbar-toggle is-on' : 'topbar-toggle'}
                aria-pressed={backdrop}
                onClick={() => setBackdrop((on) => !on)}
                title="Fade the selected site's photograph into the page background"
              >
                <span className="backdrop-dot" aria-hidden="true" />
                Site backdrop
              </button>
              <span className={usingMockData ? 'status status-mock' : 'status status-live'}>
                <span className="status-dot" />
                {usingMockData ? 'Sample data' : 'Live API'}
              </span>
            </>
          ) : null}
          <a
            className="topbar-link"
            href="https://www.spaceappschallenge.org/2026/challenges/identify-earth-locations-that-analog-the-permanent-moon-base-locations-and-mars/"
            target="_blank"
            rel="noreferrer"
          >
            NASA Space Apps 2026
          </a>
        </div>
      </header>

      {route === 'home' ? (
        <HomePage
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
        meanFit={stats.meanFit}
        strong={stats.strong}
        datasetCount={datasets.length}
      />

      {error ? <p className="error">⚠ {error}</p> : null}

      <main className="workbench">
        <section className="card list-card" id="ranked-sites" tabIndex={-1}>
          <header className="card-head">
            <div className="card-head-text">
              <h2>Ranked sites</h2>
              <p>{target === 'moon' ? 'Moon' : 'Mars'} analog fit</p>
            </div>
            <label className="select">
              <span className="sr-only">Sort sites by</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
                <option value="fit">Best fit</option>
                <option value="moon">Moon fit</option>
                <option value="mars">Mars fit</option>
                <option value="name">Name</option>
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

        <section className="card globe-card" aria-label="Site globe">
          {/* Blind mode: to a listener the globe is decoration, so say what it
              carries and where the same information lives in text. */}
          <p className="sr-only">
            A 3D globe marks the {visiblePredictions.length} matching sites as beacons
            sized and coloured by {target} analog fit. It holds nothing the ranked list does
            not: the same sites appear there in the same order, each with its terrain, its
            Moon fit and its Mars fit.
          </p>
          <div className="globe-stage">
            {/* Remounted when the motion preference changes: the scene reads the
                setting once, when it builds its animation loop. */}
            <EarthGlobe
              key={a11y.reduceMotion ? 'globe-reduced-motion' : 'globe-free'}
              predictions={visiblePredictions}
              selectedId={selectedId}
              target={target}
              onSelect={setSelectedId}
              imageryDate={imageryDate}
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
                {showClouds ? (
                  <label className="imagery-date">
                    <span className="sr-only">NASA imagery date (UTC)</span>
                    <input
                      type="date"
                      value={imageryDate}
                      min={IMAGERY_WINDOW.min}
                      max={IMAGERY_WINDOW.max}
                      onChange={(event) => {
                        const next = event.target.value;
                        if (!next || next === imageryDate) return;
                        setImageryDate(next);
                        setImagery(null);
                      }}
                    />
                  </label>
                ) : null}
              </div>
              <div className="globe-side">
                <ul className="legend" aria-label="Marker legend">
                  <li>
                    <span className="legend-dot" style={{ background: scoreColor(0.9) }} />
                    Strong
                  </li>
                  <li>
                    <span className="legend-dot" style={{ background: scoreColor(0.65) }} />
                    Promising
                  </li>
                  <li>
                    <span className="legend-dot" style={{ background: scoreColor(0.4) }} />
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
                  <span className="strip-score" style={{ color: scoreColor(fitFor(selected, target)) }}>
                    {formatScore(fitFor(selected, target))}
                    <span className="strip-score-unit">{target} fit</span>
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

        <section className="card dossier-card" id="site-dossier" tabIndex={-1}>
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
              onExport={exportCsv}
              onCopyLink={copyLink}
              onSeeSite={() => selected && setGallerySite(selected)}
              onCompare={() => selected && openCompare(selected)}
              copied={copied}
            />
          )}
        </section>
      </main>

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
            fit distribution · feature influence · lunar reference · data sources
          </span>
        </button>

        {evidenceOpen ? (
          <div className="evidence-grid">
            <Panel title="Fit distribution" subtitle="Sites per analog-fit bucket">
              <ScoreDistribution predictions={visiblePredictions} />
            </Panel>
            <Panel title="Feature influence" subtitle="Mean absolute contribution">
              <FeatureImportance predictions={visiblePredictions} />
            </Panel>
            {/* The reference globe follows the selected target: Moon phase on
                one side, Mars's real sub-solar point and season on the other. */}
            <Panel
              title="Comparison target"
              subtitle={
                target === 'moon' ? 'Moon · real phase right now' : 'Mars · real sun angle right now'
              }
            >
              {target === 'moon' ? (
                <MoonMap predictions={NO_PREDICTIONS} showMarkers={false} />
              ) : (
                <MarsMap />
              )}
            </Panel>
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

      <AccessibilityDock settings={a11y} onMode={chooseMode} onChange={updateA11y} />

      <footer className="app-foot">
        <span>
          Challenge: identify Earth locations that analog the permanent Moon base locations and Mars.
        </span>
        <span className="foot-note">
          Scores are model estimates, not measurements. Coordinates are real analog sites; feature
          values are illustrative sample data.
        </span>
      </footer>
    </div>
  );
}
