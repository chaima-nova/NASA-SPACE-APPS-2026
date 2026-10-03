# Visualization / Web Shell — Jasmine's part

Reusable web shell for the NASA challenge: **map + charts + 3D visualization**,
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

- `Risk map` — MapLibre map, one coloured/sized point per prediction.
- `3D risk columns` — Three.js grid where height + colour encode risk.
- `Risk distribution` — histogram of heat-risk scores.
- `Feature influence` — mean absolute feature contribution.
- `Data sources` — the NASA datasets catalogued by Abid.

## How this plugs into the rest of the system

The whole UI reads through **one seam**: `src/services/api.ts`.

- Leave `VITE_API_BASE_URL` unset → built-in mock data (default).
- Set `VITE_API_BASE_URL` to Chaima's backend → every panel switches to live data.

Expected endpoints:

```
GET {base}/predictions   -> Prediction[]    (Harshil, ML output)
GET {base}/datasets      -> DataSource[]    (Abid, NASA catalogue)
GET {base}/space/objects -> OrbitalObject[] (Zehra, space systems)
```

### Data contracts

All shapes live in `src/data-contracts/types.ts` and are the agreed interface:

| Type            | Owner                | Purpose                                  |
| --------------- | -------------------- | ---------------------------------------- |
| `DataSource`    | Abid                 | NASA dataset catalogue entry             |
| `GeoPoint`      | Farwa                | Sample point + numeric feature vector    |
| `Prediction`    | Harshil              | ML inference result (score, label, etc.) |
| `OrbitalObject` | Zehra                | TLE / orbital element set                |

If the backend field names differ, update **only** `types.ts` + `services/api.ts`;
components stay untouched.

### Swapping in real data

1. Backend exposes the endpoints above.
2. Create `.env` with `VITE_API_BASE_URL=https://<backend-host>`.
3. Restart `npm run dev`. The header badge flips from **Mock data** to **Live API**.

## Notes / next steps

- The demo MapLibre style (`demotiles.maplibre.org`) needs no API key. Swap it
  for a proper basemap (or vector tiles from Farwa) when needed.
- The 3D scene is a structural placeholder — swap the box grid for city blocks
  / terrain / a globe once Farwa's geometry is final.
- `getOrbitalObjects()` is already wired but not yet rendered; a space-systems
  panel can consume it directly.
