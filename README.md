# Visualization / Web Shell — Jasmine's part

Reusable web shell for the NASA Space Apps 2026 challenge **"Identify Earth
Locations that Analog the Permanent Moon Base Locations and Mars"**:
**map + charts + 3D visualization** of candidate terrestrial analog sites,
running on typed sample data now and structured to receive real outputs from the
rest of the team later.

## Stack

| Concern    | Library                |
| ---------- | ---------------------- |
| App shell  | React 19 + Vite (TS)   |
| Charts     | Recharts               |
| 3D / Moon  | Three.js (+ OrbitControls, postprocessing) |

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

The Moon surface textures in `public/moon/` are committed, so nothing extra is
needed to run. To regenerate them from the original NASA TIFFs, download
`lroc_color_poles_8k.tif` and `ldem_16_uint.tif` from the
[CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) and run
`node scripts/build-moon-textures.mjs <sourceDir>`.

> The shell currently runs entirely on **mock data** — no backend needed.

## What's built

- `Analog site map` — interactive Three.js Moon globe. Real LROC colour and
  LOLA elevation (displaced geometry + bump), one coloured/pulsing marker per
  candidate site. Drag to orbit, scroll to zoom, hover for the analog-fit score.
- `Analog fit columns` — Three.js bars where height + colour encode analog fit.
- `Fit distribution` — histogram of analog-fit scores.
- `Feature influence` — mean absolute feature contribution.
- `Data sources` — the NASA datasets catalogued by Abid.

Candidate sites in the mock set are real, well-known analog locations (Atacama
Desert, Haughton Crater, Death Valley, McMurdo Dry Valleys, Mauna Kea/Kilauea,
Río Tinto, Lanzarote, Craters of the Moon, Qaidam Basin, Mojave, Askja). The
numeric feature vectors and the analog-fit scores are illustrative sample values
— they stand in for Harshil's model output, not measurements.

## How this plugs into the rest of the system

The whole UI reads through **one seam**: `src/services/api.ts`.

- Leave `VITE_API_BASE_URL` unset → built-in mock data (default).
- Set `VITE_API_BASE_URL` to Chaima's backend → every panel switches to live data.

Expected endpoints:

```
GET {base}/predictions   -> Prediction[]    (Harshil, ML output / analog-fit scores)
GET {base}/datasets      -> DataSource[]    (Abid, NASA catalogue)
GET {base}/space/objects -> OrbitalObject[] (Zehra, space systems)
```

### Data contracts

All shapes live in `src/data-contracts/types.ts` and are the agreed interface:

| Type            | Owner                | Purpose                                     |
| --------------- | -------------------- | ------------------------------------------- |
| `DataSource`    | Abid                 | NASA dataset catalogue entry                |
| `GeoPoint`      | Farwa                | Candidate site + numeric feature vector     |
| `Prediction`    | Harshil              | Analog-fit inference result (score, label)  |
| `OrbitalObject` | Zehra                | TLE / orbital element set                   |

If the backend field names differ, update **only** `types.ts` + `services/api.ts`;
components stay untouched.

### Swapping in real data

1. Backend exposes the endpoints above.
2. Create `.env` with `VITE_API_BASE_URL=https://<backend-host>`.
3. Restart `npm run dev`. The header badge flips from **Mock data** to **Live API**.

## Moon surface data

`public/moon/lroc-color-4k.jpg` and `public/moon/ldem-4k.png` are derived from
the [NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) (LRO LROC colour mosaic
and LOLA 16 px/degree elevation). NASA data is in the public domain; the files
are committed so the app has no runtime dependency on an external host.

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

- The 3D bar scene is still a structural placeholder — swap the bar grid for
  terrain plates or regolith cross-sections once Farwa's geometry is final.
- `getOrbitalObjects()` is already wired but not yet rendered; a space-systems
  panel can consume it directly.
