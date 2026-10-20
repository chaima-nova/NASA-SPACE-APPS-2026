# Visualization / Web Shell — Jasmine's part

Reusable web shell for the NASA Space Apps 2026 challenge **"Identify Earth
Locations that Analog the Permanent Moon Base Locations and Mars"**:
**map + charts + 3D visualization** of candidate terrestrial analog sites,
running on typed sample data now and structured to receive real outputs from the
rest of the team later.

## Stack

| Concern         | Library                                    |
| --------------- | ------------------------------------------ |
| App shell       | React 19 + Vite (TS)                       |
| Charts          | Recharts                                   |
| 3D / Earth      | Three.js (OrbitControls, custom GLSL terminator) |
| 3D / Moon       | Three.js (displacement, bloom, real phase) |

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

The Moon and Earth surface textures in `public/moon/` and `public/earth/` are
committed, so nothing extra is needed to run. To regenerate the Moon maps from
the original NASA TIFFs, download `lroc_color_poles_8k.tif` and
`ldem_16_uint.tif` from the [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) and
run `node scripts/build-moon-textures.mjs <sourceDir>`.

> The shell currently runs entirely on **mock data** — no backend needed.

Full walkthrough: **`HOW-TO-USE.txt`** (plain text, every control and shortcut).

## What's built

The shell has three tabs, all hash routes (`#/home`, `#/solution`, `#/team`) so a
static host needs no rewrite: **Home** is the cover — a NASA photograph behind
one headline and one button, with the counts read from the loaded data;
**Solution** is the workbench described below; **Our team** is the team's work
plan, read from `src/data/team.ts`.

Three-zone discovery surface, one screen, one job: *which Earth sites are the
best analogs, for which target, and why.*

- **Facet row** — Moon/Mars target toggle, the brief's terrain families as chips
  (desert, arid, polar, volcanic, cave, impact, fluvial), live KPIs.
- **Ranked sites** (left) — fit-ranked queue, sortable, keyboard-walkable, with
  a score bar per row. Selection is shared with the globe and the dossier.
- **Hero Earth globe** (centre) — NASA Blue Marble (cloud-free) with a real
  solar terminator, night-side city lights, normal-mapped terrain relief, and a
  sidereal-anchored star background. A **Live Cloud Layer** button fades in
  NASA GIBS's VIIRS true-colour pass for any of the last 60 days; the base stays
  clear by default so sites are never hidden. No glint and no atmosphere shell: the
  surface stays matte. One fit-coloured beacon per site; clicking a beacon
  flies the camera in from the global view to a real DEM terrain model of that
  site (see below). Press-and-drag is always an orbit: a beacon is picked only
  by a click that stays within ~6 px, so starting a drag on a dot (or coming
  back to it before releasing) moves the globe instead of flying in, and
  grabbing the globe mid-flight cancels the dive.
- **Site dossier** (right) — the plain-language verdict, Moon-vs-Mars fit split,
  the brief's four characterization axes, dataset provenance, coordinates and
  confidence, a **See Site** field-photo gallery, an **Orbit vs ground** split
  view, researcher field notes and reviews, plus CSV export and a shareable
  permalink.
- **Researcher reporting** (left panel) — **Report a site** adds a candidate
  from the field; reported sites are listed apart from the ranking as amber
  ring markers, with a manager for editing, deleting and exporting them.
- **Evidence strip** — fit distribution, feature influence, a live-phase Moon
  reference globe, and the full NASA dataset catalogue.

Candidate sites in the mock set are real, well-known analog locations (Atacama
Desert, Haughton Crater, Death Valley, McMurdo Dry Valleys, Mauna Kea/Kilauea,
Río Tinto, Lanzarote, Craters of the Moon, Qaidam Basin, Mojave, Askja, Lava
Beds). The numeric feature vectors, per-axis factor scores and the analog-fit
scores are illustrative sample values — they stand in for Harshil's model
output, not measurements.

Keyboard: `/` focuses search, `↑`/`↓` walk the ranking, `Esc` returns to the
top site. State is reflected in the URL (`?target=mars&terrain=cave&site=…`).

## Reporting sites and community signal

A researcher can add a candidate analog site the model has never seen, and can
annotate the ones it has.

- **Report a site** — a validated form (name, coordinates, terrain family,
  proposed world, elevation, reporter, **field evidence**, optional ground-photo
  link). Coordinates are range-checked, a terrain family is required, and the
  evidence note must be substantive; a rejected submit moves the caret to the
  first problem.
- **Reported candidates are unscored, on purpose.** Nobody has extracted the
  feature vector, so the UI never invents a number: reports sit in their own
  block below the ranking, are drawn as **amber rings** rather than beacons, and
  their dossier opens with "No analog-fit score yet". They still get the full
  treatment everywhere it is honest — the globe, the terrain fly-in (real SRTM
  elevation at the reported coordinates), the orbit-vs-ground view, field notes,
  reviews and upvotes.
- **Field notes, reviews and upvotes** live in a "Researcher signal" block in
  both dossier variants: dated observations with an optional photo link, short
  assessments, and a one-per-browser upvote toggle.
- **Manager** — every report this browser holds, with edit, delete, **JSON**
  export (round-trip, `{ version, reportedSites }`) and **CSV** export.

**Storage is local-first.** Records go to `localStorage`
(`earth-analogs.community.v1`) and the UI updates immediately; when
`VITE_API_BASE_URL` is set the same records are read from and written to
`{base}/community`, and a failed sync degrades to "saved in this browser"
(surfaced in the manager) rather than losing the report. Storage reads are
defensive: a hand-edited or half-written record is dropped individually instead
of taking the store down, and records the backend supplied are marked remote and
rendered without a Delete button.

## Ambient site backdrop

Selecting a site — a beacon on the globe or a row in the list — fades that
site's own ground photograph into the page background
(`src/components/layout/SiteBackdrop.tsx`).

- It sits at `z-index: -1` inside `.app`'s stacking context — above the body
  background, below *all* interface content. (At `z-index: 0` it painted over the
  static-positioned top bar and facet row and veiled their text; confirmed with
  `document.elementsFromPoint`, which now returns the `H1` first.)
- Two strengths, both under a wash of the surface's own blue-black
  (`rgba(5,7,10,…)`) and through `saturate(0.72) brightness(0.9) hue-rotate(-8deg)`:
  **30%** in the open background the layout leaves around the panels, and **~16%**
  through the panels themselves, where `.card::before` (in the card's own
  stacking context via `isolation: isolate`, so it paints above the surface and
  below every line of content) draws the photo with a 55% wash baked in to cap
  its brightest contribution. Measured on the same screen: open background mean
  luminance 7.4 → 13.2, a panel 21.9 → 24.5 of 255, with label pixels untouched.
- Each new site is preloaded off-screen and cross-faded in over the previous
  frame via a two-layer stack, so switching never flashes a blank or
  half-decoded image. Only the selected site's photo is requested.
- Sites with no photograph (a report without a picture) hand the surface back to
  plain rather than leaving an unrelated site's photo behind the UI.
- The **Site backdrop** switch in the top bar turns it off; the fade is skipped
  entirely under `prefers-reduced-motion`. Turning it off is also the way to get
  the strictest contrast back for the smallest mono labels, which sit on a
  marginally lighter surface where a photo is bright.

## Orbit vs ground

The `Orbit vs ground` action in any dossier puts the real NASA GIBS true-colour
pass for that site's bounding box next to a real ground photograph:

- Left — GIBS WMS close-up (`VIIRS_SNPP_CorrectedReflectance_TrueColor`, keyless
  and CORS-enabled, the same service as the globe's clouds) for a chosen UTC day
  in the last 60, at 50 km / 15 km / 4 km of ground, with the bbox and date
  printed underneath.
- Right — the curated Commons frame for the site (browsable) or, for a reported
  site, the photo the reporter supplied.
- Both captions state the real scale. VIIRS is ~375 m per pixel, so the pane
  says "regional context, not site detail" instead of implying a spyglass.

## Site fly-in: click a beacon, land on the terrain

Clicking any beacon dives the camera from the global view down onto that site
(~0.9 s eased move), then opens an immersive local view over the globe.

- **Real elevation.** A 3×3 window of public **Terrarium** height tiles
  (`elevation-tiles-prod` on S3 — SRTM/ASTER/NED mosaics) at zoom 10–14 is
  decoded to a 257×257 patch, roughly **7 km across at ~27 m per sample** —
  the scale at which slope, ridges, channels and crater rims are readable. The
  service is keyless and CORS-enabled, so it runs entirely in the browser.
- **Shading from the data.** Vertex colour mixes the terrain family's palette
  (desert sand, basaltic black, polar snow, red fluvial dust…) with depth,
  steep rock, per-vertex grain, and a **curvature term** (height minus a
  box-blurred reference) so gentle ground still reads as landform rather than
  flat grey. Grain, rock scatter and instanced boulders are seeded from the
  site id, so a site always looks the same.
- **The site is marked, not implied.** A pulsing cyan ring sits at the patch
  centre — the site's exact coordinates — with that latitude/longitude pinned
  just above it, so the point can be read off the landform. The caption is DOM
  text projected from the ring each frame (crisp at any zoom), keeps clear of
  the ring by its projected size rather than a fixed offset, and hides if the
  site ever leaves the frame.
- **Stats, not vibes.** Relief, mean slope, min–max elevation and the tile
  source are printed in the view, along with the vertical exaggeration factor.
- **Never a dead end.** If the tile service is unreachable the patch falls back
  to deterministic procedural relief shaped by the site's terrain family, and
  the stats strip says `Procedural` instead of `SRTM 30 m`. The view is keyboard
  dismissible (**Esc**) or via **Back to Globe**, which flies the camera back to
  the framing it had before the dive.

Measured in-browser on the sample sites: real DEM for every site tried, with
plausible ground truth (Kīlauea 1,026–1,389 m, Qaidam Basin 2,682–2,713 m,
McMurdo Dry Valleys 140–1,301 m, Timanfaya 240–498 m).

## See Site: field photography

**See Site** in the dossier opens a modal carousel of real ground photographs
for the selected site — the site itself, its rocks and cores, and
expedition/rover work where relevant.

- Source: **Wikimedia Commons**, curated per site in `src/data/sitePhotos.ts`
  (three frames each for the 13 sample sites). Images stream through Commons'
  `Special:FilePath` endpoint with a server-side resize, so nothing is bundled
  and the photographer and licence stay attached to every frame.
- Each frame shows its caption, photographer, licence and a link to the Commons
  file page; the footer states plainly that these are field references near the
  site, not survey imagery of the exact coordinates.
- Navigation: arrow buttons, a thumbnail rail, ←/→ (wrapping), Home/End, Esc to
  close, backdrop click to dismiss. Neighbouring frames are preloaded so
  browsing never waits on the network, focus is trapped in the dialog while it
  is open and returns to **See Site** when it closes.

## How this plugs into the rest of the system

The whole UI reads through **one seam**: `src/services/api.ts`.

- Leave `VITE_API_BASE_URL` unset → built-in mock data (default).
- Set `VITE_API_BASE_URL` to Chaima's backend → every panel switches to live data.

Expected endpoints:

```
GET    {base}/predictions    -> Prediction[]    (Harshil, ML output / analog-fit scores)
GET    {base}/datasets       -> DataSource[]    (Abid, NASA catalogue)
GET    {base}/space/objects  -> OrbitalObject[] (Zehra, space systems)
GET    {base}/community      -> CommunityState  (reports, notes, reviews, votes)
POST   {base}/community      -> one record ({ kind: 'reportedSite' | 'note' | 'review' | 'vote', ... })
DELETE {base}/community/{id} -> remove one record
```

### Data contracts

All shapes live in `src/data-contracts/types.ts` and are the agreed interface:

| Type            | Owner                | Purpose                                     |
| --------------- | -------------------- | ------------------------------------------- |
| `DataSource`    | Abid                 | NASA dataset catalogue entry                |
| `GeoPoint`      | Farwa                | Candidate site + numeric feature vector     |
| `Prediction`    | Harshil              | Analog-fit inference result (score, label)  |
| `OrbitalObject` | Zehra                | TLE / orbital element set                   |
| `ReportedSite`  | field / community    | Researcher-submitted candidate, unscored    |
| `CommunityState`| community            | Reports + notes + reviews + votes payload   |

If the backend field names differ, update **only** `types.ts` + `services/api.ts`;
components stay untouched.

### Swapping in real data

1. Backend exposes the endpoints above.
2. Create `.env` with `VITE_API_BASE_URL=https://<backend-host>`.
3. Restart `npm run dev`. The header badge flips from **Mock data** to **Live API**.

## Surface data

**Earth.** `public/earth/blue-marble-ice-4k.jpg` is NASA's Blue Marble (July
2004, 5400×2700, with topography and bathymetry) from [NASA Visible
Earth](https://visibleearth.nasa.gov/), with Arctic sea ice composited in
above 72°N from the Blue Marble land/ocean/ice product — the bathymetry
channel shows the ocean floor at the pole, which reads as a dark disc. A small
GLSL shader combines it with four more layers:

- `night-lights-3600.jpg` — NASA Earth at Night (2012) city lights, fading in
  through twilight.
- `terrain-normal-2k.jpg` — normal-mapped relief from an analytic tangent
  frame, so mountains catch the light at the limb.
- a live sub-solar point for the terminator, with a readable night floor so
  sites on the dark hemisphere stay visible.
- the **Live Cloud Layer** (off by default) — the VIIRS true-colour mosaic for a
  chosen UTC day, streamed live from [NASA
  GIBS](https://nasa-gibs.github.io/gibs-api-docs/)
  (`VIIRS_SNPP_CorrectedReflectance_TrueColor`) as a single 3072×1536 WMS
  image. GIBS is keyless and CORS-enabled, so the browser fetches it
  directly. Near-black no-data texels (the polar caps and swath gaps) fall
  back to Blue Marble, and the pass fades out between 62° and 72° latitude, so
  its coverage edge never draws a hard circle at either pole.

**Stars.** `public/moon/starmap-4k.jpg` is NASA's Deep Star Maps 2020. The map
is flipped and offset by Greenwich sidereal time, so it is anchored to the
Earth's rotation axis and the real sky rather than being decorative; it also
advances at the real sidereal rate. Verified against 20 bright stars
(20/20 land on bright pixels).

**Cover.** `public/home/arctic.jpg` (1800×1012) is the Home backdrop, and
`public/home/desert.jpg` (2048×1152) is painted on top by the pointer: one broad
soft-edged brush lays a single stroke into a canvas mask, tapering and drying out
behind the cursor so the ice is back a second or two after you stop. Both files are 2× upscales
with an unsharp pass over the originals, committed, so the page has no runtime
dependency on an external host; swapping in others is a file replacement, no
code change. The brush follows a fine pointer only — touch, reduced motion and
blind mode keep the ice frame.

**Moon.** `public/moon/lroc-color-4k.jpg` and `public/moon/ldem-4k.png` are
derived from the [NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) (LRO LROC
colour mosaic and LOLA 16 px/degree elevation). NASA data is in the public
domain; the files are committed so the app has no runtime dependency on an
external host. `MoonMap` is used on the evidence strip as a comparison target
with markers off — terrestrial sites do not belong on a lunar sphere.

### Verifying the Moon

`npm run verify:moon` samples both textures at the coordinates of known lunar
features and checks they behave as expected — maria darker than highlands,
Tycho bright, basins lower than the highlands. It also runs a
mirrored-longitude control, which fails, confirming the orientation is correct
rather than merely plausible.

Two things the globe deliberately does **not** model: the elevation map is
normalised to its observed range rather than to real metres (the kit ships
unscaled uint16 counts), so vertical relief is exaggerated and exaggerated
uniformly; and the sky has no fixed date, time or observer, so the starfield
is decorative rather than an accurate view from a given place.

## Notes / next steps

- `src/components/three/AnalogScene.tsx` (the old fit-columns demo) is no longer
  mounted; it is kept in the repo as a possible secondary demo view.
- `getOrbitalObjects()` is already wired but not yet rendered; a space-systems
  panel can consume it directly.
- Optional contract fields (`moonFit`, `factors`, `terrainType`, `region`,
  `elevationM`, `datasetIds`, `verdict`) degrade to documented fallbacks in
  `src/lib/site.ts`, so an older backend payload still renders.
- The terrain view takes one 7 km crop per site. A wider mosaic, a USGS TADP
  satellite/field split view, and per-site ground-truth photo uploads are the
  natural next steps.
