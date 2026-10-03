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
| Map        | MapLibre GL JS         |
| Charts     | Recharts               |
| 3D         | Three.js (+ OrbitControls) |

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

> The shell currently runs entirely on **mock data** — no backend needed.

## What's built

- `Analog site map` — MapLibre world map, one coloured/sized point per candidate site.
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

## Notes / next steps

- The demo MapLibre style (`demotiles.maplibre.org`) needs no API key. Swap it
  for a proper basemap (or vector tiles from Farwa) when needed.
- The 3D scene is a structural placeholder — swap the bar grid for terrain
  plates, regolith cross-sections, or a globe once Farwa's geometry is final.
- `getOrbitalObjects()` is already wired but not yet rendered; a space-systems
  panel can consume it directly.
