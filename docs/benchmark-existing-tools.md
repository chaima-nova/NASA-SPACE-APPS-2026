# Benchmark: Existing Spatial-Exploration Tools + a Lightweight UI Layout

**Project:** NASA International Space Apps Challenge 2026
**Challenge:** *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*
**Track:** Planetary Science & Earth Analogs
**Owner:** Jasmine — UI / Frontend (shell, visualization, interaction)
**Doc type:** Research benchmark + wireframe proposal

---

## Summary

1. **Nothing on the market does what this challenge asks.** Every existing tool is either
   (a) an *analog gallery* with no ranking, (b) a *planetary map* with no Earth comparison,
   or (c) a *data archive* with a catalog UI but no analysis. The gap is a **ranked, explainable
   Earth-site discovery surface**.
2. **Winners win on one strong canvas + one honest claim**, not on feature count. The 2023
   science *and* technology awards both went to Moonquake Map 2.0 projects; the 2024 science
   award went to a physically-correct 3D orrery. Depth beats breadth.
3. **The closest incumbent is NASA's own Planetary Analog Explorer** — 11 hand-picked
   Earth↔other-world pairs with a before/after slider. It is beautiful and completely
   non-quantitative. We should match its clarity and beat it on coverage + ranking.
4. **The closest data incumbent is the USGS Terrestrial Analogs Data Portal (TADP)** — a
   ScienceBase-backed repository of analog sites, samples and field guides. Strong provenance,
   weak discovery experience. We should borrow its provenance model, not its UI.
5. **Our thesis:** *one screen that answers "which Earth sites are the best analogs, for which
   target, and why"* — ranked list + globe + per-site dossier + dataset provenance, with a
   Moon-fit / Mars-fit split and the brief's terrain facets as first-class filters.

---

## 1. What the brief actually constrains

The published challenge text (2026 challenge page) says, in substance:

> Selecting future landing sites and lunar base locations depends on topography, geology,
> environment and available resources. Earth sites analogous to the Moon or Mars — the
> Atacama Desert, Haughton Crater, Death Valley — let teams test equipment and methods before
> they fly, but such terrestrial analog sites are **not entirely well characterized**.
> Use open Earth, Moon and Mars data to **identify and characterize new terrestrial analogs**,
> drawing on **deserts, polar regions, volcanic and arid terrains, caves** and other
> environments that share conditions with the lunar or Martian surface.

Three verbs drive the UI:

| Verb in the brief | UI obligation |
|---|---|
| **Identify** | A discovery surface: candidate sites, coverage, filtering, ranking |
| **Characterize** | A per-site dossier with the factors named in the brief (topography, geology, environment, resources) |
| **Analog** (to Moon *or* Mars) | A visible Moon-vs-Mars fit split, not one opaque number |

The brief lists terrain types explicitly — **desert, polar, volcanic, arid, cave** — so terrain
type is a filter, not a tag buried in a tooltip.

---

## 2. How Space Apps projects actually win

### 2.1 The award set (2025 definitions, unchanged going into 2026)

| Award | Official definition |
|---|---|
| Best Use of Science | Best and most valid use of science and/or the scientific method |
| Best Use of Data | Best makes space data accessible, or leverages it for a unique application |
| Best Use of Technology | Most innovative use of technology |
| Galactic Impact | Most potential to improve life on Earth or in the universe |
| Best Mission Concept | Most plausible concept and design |
| Most Inspirational | Captures our hearts |
| Best Use of Storytelling | Most creatively communicates the potential of open data |
| Global Connection | Best connects people around the world through technology |
| Art & Technology | Most effectively combines technical and creative skills |
| Local Impact | Greatest potential for local impact |

Judging runs local event → Global Nominee → Global Finalist → executive judging → 10 Global Winners.
In 2025 that was 11,500+ submissions for 10 slots.

### 2.2 Winners whose *layout* is worth copying

| Year | Award | Project | Challenge | What the layout proved |
|---|---|---|---|---|
| 2023 | Best Use of Science | **LunarTech Ensemble** (Egypt) | Make a Moonquake Map 2.0 | A website **plus** an immersive game over Apollo seismic data — same dataset, two entry points for two audiences |
| 2023 | Best Use of Technology | **Spacebee** (US/Argentina) | Make a Moonquake Map 2.0 | Map of quake locations, quake **type**, date, and ALSEP data plots in one view — map + evidence side by side |
| 2024 | Best Use of Science | **WMPGang — SkyShield** (Canada) | Orrery web app for NEOs | One full-screen 3D canvas; filters for orbit, size, Palermo rating; time that runs live, fast and **backwards** |
| 2024 | Best Mission Concept | **AsturExplorers — Landsat Connect** (Spain) | Landsat reflectance on the fly | Map pin → notification → 3×3 pixel readout → CSV/PDF export; WCAG 2.1 specified up front |
| 2024 | Local Impact | **Team I.O. — G.R.O.W.** (Brazil) | Community mapping | GIS complexity hidden behind plain-language answers for non-experts |
| 2024 | Art & Technology | **Connected Earth Museum** (Brazil) | Imagine our Connected Earth | 3D + 2D visualization gallery with a guided host — narrative wrapper around charts |
| 2025 | Best Use of Science | **SpaceGenes+** (Germany) | Space Biology Knowledge Engine | A single interactive dashboard that answers one research question well — no feature sprawl |
| 2025 | Best Use of Technology | **Twisters — SkySense** (Mexico) | Will It Rain on My Parade? | Turns raw variables into a **risk verdict plus a recommended time window** — decision, not data |
| 2025 | Best Mission Concept | **PureFlow** (Brazil) | Habitat Layout Creator | Design in 3D, then **validate against a real threat** (solar storms) in the same screen |


### 2.3 The pattern behind the pattern

Winners consistently ship **one screen with one job**:

1. **A hero spatial canvas** dominates; panels are subordinate.
2. **Filters, not search boxes** — the user narrows a space, they don't guess keywords.
3. **Time is a control**, not a caption (SkyShield's reverse time; Worldview's timeline).
4. **Click → evidence.** The detail view explains *why*, with the numbers that produced it.
5. **A decision, stated in words** — "safest window 14:00–16:00", not "humidity 62%".
6. **Export or share** the artifact (CSV, PDF, permalink) so the work survives the demo.
7. **Accessibility is designed, not patched** (Landsat Connect won a concept award on a Figma
   prototype largely because it specified WCAG 2.1, localization and offline behaviour).
8. **A story frame** — a human sentence at the top of the screen that says why this matters.

What did **not** win: grids of equal-weight cards with no focal point, dashboards that show every
metric at once, and projects where the data source is more impressive than the answer.

---

## 3. Benchmark: the tools that already exist

### 3.1 Landscape

| # | Tool | Operator | What it is | Interaction model | Strong at | Stops short at |
|---|---|---|---|---|---|---|
| 1 | **Planetary Analog Explorer** | NASA Science | Gallery of 11 Earth ↔ other-world analog pairs | Side-by-side image slider + "image details" | Clarity, storytelling, instant comprehension | No search, no ranking, no coverage, 11 pairs total |
| 2 | **Terrestrial Analogs Data Portal (TADP)** | USGS Astrogeology | Repository/discovery portal for analog sites, samples, field data (ScienceBase) | Catalog search + record pages | Provenance, sample-level metadata, field guides | Not a visualization; no fit scoring; researcher-oriented |
| 3 | **Solar System Treks** (Moon/Mars/Mercury/Vesta/…) | NASA | Browser 3D portals over real mission data | 3D globe, layer stack, draw tools | 3D terrain, distance, elevation profile (CSV), sun angle, VR, 3D print, WMS map services | One world at a time; no Earth↔target comparison; no site ranking |
| 4 | **LROC QuickMap** | ASU / NASA LRO | Lunar map interface, 2D + 3D, very large layer catalog | Map + layer tree + draw/measure | Depth of lunar layers, elevation profiles, illumination simulation | Expert tool; steep learning curve; lunar only |
| 5 | **JMARS** | ASU Mars Space Flight Facility | Desktop planetary GIS, >1 TB of orbiter data | Layer manager + ROI + plots + SQL-like scripting | Mission-grade analysis, THEMIS/HiRISE/CTX/CRISM/MOLA, landing-site layers | Desktop install, heavy, assumes a scientist |
| 6 | **NASA Worldview** | NASA EOSDIS / GIBS | 1,200+ Earth imagery layers, near real-time | Map + timeline + compare (swipe / opacity / spy) | Time navigation, layer comparison, events tab, embeddable, mobile-friendly | Earth only; imagery browsing, not site evaluation |
| 7 | **NASA's Eyes on the Solar System** | NASA/JPL | 3D solar system with real ephemerides and time travel | 3D camera, time scrubber, object selection | Scale, motion, "wow", mission context | No surface-level site analysis; no data tables |
| 8 | **ESA PANGAEA** | ESA | Astronaut field-geology course across planetary analogue sites (Bletterbach, Ries, Lanzarote, Lofoten) | Field course + Electronic FieldBook | Domain credibility, site selection rationale, field protocol | Not a public tool; no interactive product |
| 9 | **Google Earth Pro / Google Mars** | Google | Consumer globe with historical imagery and measurement | Search + fly-to + measure | Familiarity, speed, imagery history | No planetary science layers, no analog logic, no scoring |
| 10 | **QGIS / ArcGIS Earth** | Open source / Esri | Professional GIS | Layer stack + analysis toolbox | Full analytical control, export | Not planetary by default, not a public-facing product |

### 3.2 Scorecard (1 = absent, 5 = best in class — assessment relative to *this* challenge)

| Tool | 3D / spatial | Multi-layer | Time control | Side-by-side compare | Site ranking / scoring | Per-site evidence | Mobile & a11y | Time-to-first-insight |
|---|---|---|---|---|---|---|---|---|
| Planetary Analog Explorer | 3 | 1 | 1 | **5** | 1 | 3 | 3 | **5** |
| TADP | 2 | 2 | 1 | 1 | 1 | 4 | 3 | 2 |
| Solar System Treks | **5** | 4 | 2 | 2 | 1 | 4 | 3 | 3 |
| LROC QuickMap | **5** | **5** | 2 | 2 | 2 | 4 | 2 | 2 |
| JMARS | **5** | **5** | 3 | 3 | 1 | 4 | 1 | 1 |
| NASA Worldview | 4 | **5** | **5** | 4 | 1 | 3 | 4 | 4 |
| Eyes on the Solar System | **5** | 2 | 4 | 1 | 1 | 2 | 3 | 4 |
| **Our shell (target)** | 4 | 3 | 3 | 4 | **5** | **5** | 4 | **5** |

The empty columns across the entire market are **site ranking** and **explainable per-site
evidence**. Those are our two differentiators.

### 3.3 Profiles of the four that matter most

**Planetary Analog Explorer — the experience benchmark.**
Eleven curated pairs: lava caves (California ↔ Moon), Death Valley (↔ Mars), Kilauea (↔ Moon),
Lake Salda (↔ Mars), Pilot Valley (↔ Mars), Atacama (↔ Mars), Gulkana Glacier (↔ Enceladus),
Askja (↔ lunar south pole), Aden Crater (↔ Venus), Verde Valley (↔ Mars), and a Mars ripple field
(↔ Iceland). Each pair is a draggable before/after with a short "why this pair" paragraph and a
scale note.
*Borrow:* the slider comparison, the plain-language caption, the honesty about scale.
*Beat:* it is curated and closed. Ours is generated, ranked, filterable and exportable.

**Solar System Treks — the 3D benchmark.**
Browser portals over real mission data with 3D flyovers, distance/elevation measurement (with
CSV export), sun-angle calculation, VR flyovers, 3D-printable terrain, and OGC map services that
can be embedded in other clients.
*Borrow:* elevation profile as a first-class tool; sun-angle as a proxy for illumination;
"download the artifact" as a habit; WMS as the path to real basemaps.
*Beat:* it never asks which Earth site is the better analog, and it cannot show two worlds at once.

**LROC QuickMap + JMARS — the analyst benchmark.**
QuickMap is the accessible end (2D/3D, a very large layer catalog, draw-and-profile); JMARS is the deep
end (>1 TB, layer manager, ROI tools, landing-site layers, SQL-like scripting, mission planning).
*Borrow:* the layer tree pattern; the "region of interest" concept — our analog site *is* an ROI.
*Beat:* both require the user to already know what they are looking for. Neither has an opinion.

**TADP + USGS analog pages — the data benchmark.**
The USGS has run analog work since Apollo: Cinder Lake crater field (blasted to match two Apollo
landing sites), Meteor Crater, SP Mountain, Sunset Crater, Lava River Cave, Grand Canyon, plus a
sample collection and the TADP repository.
*Borrow:* cite the dataset behind every number; treat sample/field data as provenance, not decoration.
*Beat:* turn a repository into a discovery surface.

**Worldview — the time benchmark.**
1,200+ layers, near-real-time imagery, timeline animation, swipe/opacity/spy comparison, an events
tab, and an OpenLayers/GIBS architecture that is embeddable.
*Borrow:* the compare modes and the timeline scrubber.
*Beat:* Worldview shows what Earth looks like; we say which parts of it behave like Mars.

---

## 4. Gap analysis → product thesis

| Gap in the market | What we ship |
|---|---|
| No tool ranks terrestrial analogs by fit | **Ranked candidate list** with score, bucket and confidence |
| One score hides the Moon-vs-Mars question | **Moon-fit / Mars-fit split bar** per site |
| Analog galleries are curated, not computed | **Filterable candidate set** (terrain, target, region, score floor) |
| No explanation of *why* a site scores | **Factor breakdown** mapped to the brief's four axes |
| Provenance is invisible in most UIs | **Dataset chip row** per site, linked to the source catalogue |
| Analyst tools are expert-only | **Plain-language verdict** ("Strong Mars analog — arid, basaltic, low UV shelter") |
| Results die in the browser | **CSV / permalink export** of the shortlist |

**One-line thesis:** *the discovery layer that sits between NASA's analog science and everyone
else* — rank the sites, show the evidence, let people take the shortlist away.

---

## 5. Proposed lightweight layout

### 5.1 Principles

- **One hero canvas.** The globe is the screen; everything else orbits it.
- **Three zones, one glance.** Candidates (left) → place (centre) → proof (right).
- **Nothing more than one click from a number to its source.**
- **Filters before search.** The brief already names the facets; expose them as chips.
- **Keep the existing theme.** The PureFlow space-glass system (`--space-void`, `--glass-bg`,
  `--nebula-blue`, `--nebula-cyan`) already reads as "NASA-adjacent premium". Re-skin, don't rebuild.

### 5.2 Desktop wireframe (≥ 1280 px)

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│  ◐  EARTH ANALOGS FOR MOON & MARS BASES           [ search sites… ]      Mock data │
│  ──────────────────────────────────────────────────────────────────────────────── │
│  Target  ( Moon ◀────────────▶ Mars )    Terrain  [Desert][Polar][Volcanic]        │
│                                                    [Arid][Cave][All]              │
├──────────────────┬────────────────────────────────────────────┬────────────────────┤
│  RANKED SITES 16 │                                            │  SITE DOSSIER      │
│  sort: fit ▾     │              HERO EARTH GLOBE              │  Atacama Desert    │
│ ┌──────────────┐ │        sites sized + coloured by fit       │  Chile · desert    │
│ │ 01 Atacama   │ │                                            │  ────────────────  │
│ │    ●●●●● 0.91│ │            ●  ○   ●                        │  Moon fit   ████░  │
│ ├──────────────┤ │        ●        ◉        ○                 │  Mars fit   ███░░  │
│ │ 02 Haughton  │ │              ●                             │  ────────────────  │
│ │    ●●●●○ 0.87│ │                                            │  WHY THIS SITE     │
│ ├──────────────┤ │   ┌──────────────────────────────────────┐ │  topography  ████  │
│ │ 03 Río Tinto │ │   │ 24.5°S  68.2°W · 2,300 m · arid      │ │  geology     █████ │
│ │    ●●●●○ 0.84│ │   └──────────────────────────────────────┘ │  environment ███░  │
│ ├──────────────┤ │                                            │  resources   ██░░  │
│ │ 04 …         │ │   [ ◎ compare with Moon ]  [ ⟲ reset ]    │  ────────────────  │
│ └──────────────┘ │                                            │  DATASETS  MODIS · │
│                  │                                            │  ASTER · POWER     │
│  16 of 16 shown  │                                            │  [CSV] [permalink] │
├──────────────────┴────────────────────────────────────────────┴────────────────────┤
│  FIT DISTRIBUTION  ▁▂▅▇▅▂   │  FEATURE INFLUENCE  ████▌     │  DATA SOURCES  8   │
└────────────────────────────────────────────────────────────────────────────────────┘
```

Grid: `280px | minmax(0,1fr) | 340px`, 1 rem gaps, full-bleed inside `max-width: 1600px`.
The bottom strip is collapsible so the globe can take 100vh in demo mode.

### 5.3 Mobile wireframe (≤ 720 px)

```
┌──────────────────────────┐
│ Earth Analogs       [☰]  │
│ [Desert][Polar][Arid]+   │
├──────────────────────────┤
│                          │
│        EARTH GLOBE       │
│      (pinch / drag)      │
│                          │
├──────────────────────────┤
│ 01  Atacama       0.91 ▸ │
│ 02  Haughton      0.87 ▸ │
│ 03  Río Tinto     0.84 ▸ │
│ …                        │
└──────────────────────────┘
   tap → bottom sheet (60vh)

┌──────────────────────────┐
│ ═══  Atacama Desert      │
│ Chile · desert · 24.5°S  │
│ Moon ████░ 0.88          │
│ Mars ███░░ 0.74          │
│ WHY  topography ████     │
│      geology    █████    │
│      …                   │
│ [CSV]      [Open in map] │
└──────────────────────────┘
```

### 5.4 Component spec

| Zone | Content | Interaction | Existing code |
|---|---|---|---|
| Top bar | Title, data-mode badge, search | Type-ahead over site name | `App.tsx` header — keep |
| Facet row | Target toggle, terrain chips, sort | Multi-select chips, URL-synced | **new** `FilterBar.tsx` |
| Ranked list | Rank, name, score, mini bar, terrain dot | Click selects; ↑/↓ walks the list | **new** `SiteList.tsx` |
| Hero globe | Earth basemap, markers sized/coloured by fit, terminator | Drag, scroll, click marker, hover tooltip | refactor `MoonMap.tsx` → `Globe.tsx` |
| Compare control | Moon / Mars target, split toggle | Toggles the `marsFit` layer | **new** inside `Globe.tsx` |
| Dossier | Name, region, terrain, Moon/Mars bars, 4 factor bars, dataset chips, verdict sentence | Scroll; dataset chip → catalogue | **new** `SiteInspector.tsx` |
| Fit distribution | Histogram of `analogScore` | Hover bucket → highlight members | `ScoreDistribution.tsx` — reuse |
| Feature influence | Mean and per-site contributions | Toggle "all sites" / "this site" | `FeatureImportance.tsx` — extend |
| Data sources | Dataset catalogue with focus areas | Expand row | `DataSourceList.tsx` — reuse |
| Optional | 3D fit columns | Secondary "demo" panel | `AnalogScene.tsx` — demote or retire |

### 5.5 Interaction spec

- **Selection is shared state.** Clicking a list row, a globe marker or a histogram bar selects
  the same site; all three views highlight it.
- **Keyboard:** `Tab` into the list, `↑/↓` change selection, `Enter` opens the dossier,
  `Esc` clears selection, `/` focuses search.
- **URL state:** `?site=atacama&target=mars&terrain=desert,polar` so a demo can be linked.
- **Loading:** skeleton blocks, never a spinner over the whole page.
- **Empty:** "No sites match these filters — clear one to see 16 candidates."
- **Error:** keep the last good render, show an inline banner with the failing endpoint.
- **Reduced motion:** respect `prefers-reduced-motion`; disable bloom pulses and count-up.

### 5.6 Visual rules to keep it "lightweight"

- One accent per meaning: `--nebula-blue` = Moon, `--mars-red` = Mars, `--success-green` = strong fit.
- Score colour ramp stays in `src/lib/colors.ts` — single source of truth.
- Maximum three type sizes inside a panel; the dossier is the only place with four.
- No new fonts, no new icon library, no new chart library.

---

## 6. Sources

Challenge
- NASA Space Apps 2026 challenge page — *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*: https://www.spaceappschallenge.org/2026/challenges/identify-earth-locations-that-analog-the-permanent-moon-base-locations-and-mars/
- 2025 award definitions: https://www.spaceappschallenge.org/2025/awards/

Winners
- 2023 Global Winners: https://science.nasa.gov/directorates/smd/2023-nasa-international-space-apps-challenge-announces-10-global-winners/
- 2024 Global Winners: https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/
- 2025 Global Winners: https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/
- 2025 winners gallery: https://www.spaceappschallenge.org/2025/awards/global-winners/
- SkyShield project summary: https://www.crafterwiki.com/projects/skyshield-wmpgang/
- Landsat Connect project summary: https://www.crafterwiki.com/projects/landsat-connect/

Tools
- NASA Planetary Analog Explorer: https://science.nasa.gov/solar-system/analog-explorer/
- NASA Solar System Treks: https://trek.nasa.gov/
- LROC QuickMap: https://quickmap.lroc.asu.edu/
- JMARS: https://jmars.asu.edu/what-jmars
- NASA Worldview: https://www.earthdata.nasa.gov/data/tools/worldview
- NASA's Eyes: https://science.nasa.gov/eyes/
- USGS Terrestrial Analogs: https://www.usgs.gov/science/science-explorer/planetary-science/terrestrial-analogs
- USGS Terrestrial Analogs Data Portal: https://tadp.astrogeology.usgs.gov/
- ESA PANGAEA: https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/CAVES_and_Pangaea/What_is_PANGAEA
- ESA PANGAEA site list: https://en.wikipedia.org/wiki/ESA_PANGAEA

---

*Prepared for the UI/Frontend lane. Benchmark ratings are relative assessments for this
challenge, not vendor benchmarks. Layout notes on past winners are inferred from published
project descriptions and demo material.*
