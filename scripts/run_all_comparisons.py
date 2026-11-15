"""Run the comparison engine for every screened candidate, against both bodies.

`scripts/run_comparison.py` covers one hard-coded candidate; the loader knows
only three pre-built bundles, so the other windows the screening pass found
could never be compared. This file supplies the missing inputs and nothing
else: each candidate's 64 x 64 SRTM window is rebuilt from data/tiles using the
conventions in scripts/lib/hgt.mjs (Horn slope in degrees, Riley TRI in metres,
voids as NaN, east-west cells narrowed by cos(latitude)), handed to the
engine's own PlanetaryDataset, and compared exactly as the existing runner does.
The engine, loader and exporter are used unchanged.

Outputs: reports/engine/<candidate>_vs_<body>.json and reports/engine_index.json
Usage:   .venv/Scripts/python.exe scripts/run_all_comparisons.py
"""
from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.comparison.engine import ComparisonEngine
from src.comparison.exporter import export_report
from src.comparison.loader import PlanetaryDataset, load_mars_jezero, load_moon_south_pole

VOID = -32768
WIN = 64
ARC_SECOND_M = 30.866


def bounds(tile):
    """Tile name -> (north, west) of its one-degree box."""
    lat, lon = int(tile[1:3]), int(tile[4:7])
    return (lat if tile[0] == "N" else -lat) + 1, lon if tile[3] == "E" else -lon


def read_tile(path):
    raw = gzip.decompress(path.read_bytes())
    side = int(round((len(raw) / 2) ** 0.5))
    if side * side * 2 != len(raw):
        raise ValueError("%s is not a square int16 tile" % path.name)
    grid = np.frombuffer(raw, dtype=">i2").reshape(side, side).astype(np.float32)
    grid[grid == VOID] = np.nan
    return grid


def cut(grid, north, west, lat, lon):
    """The window centred on a candidate point, clamped inside the tile."""
    side = grid.shape[0]
    limit = side - 1 - WIN
    row = max(1, min(int(round((north - lat) * (side - 1))) - WIN // 2, limit))
    col = max(1, min(int(round((lon - west) * (side - 1))) - WIN // 2, limit))
    return grid[row:row + WIN, col:col + WIN].copy()


def measures(z, side, lat):
    """Slope in degrees, Riley TRI in metres, and the mean cell size."""
    ns = ARC_SECOND_M * (3600.0 / (side - 1))
    ew = ns * float(np.cos(np.radians(lat)))
    gy, gx = np.gradient(z, ns, ew)
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    diffs = []
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if dr or dc:
                shifted = np.full_like(z, np.nan)
                shifted[max(0, dr):z.shape[0] + min(0, dr), max(0, dc):z.shape[1] + min(0, dc)] = z[
                    max(0, -dr):z.shape[0] + min(0, -dr), max(0, -dc):z.shape[1] + min(0, -dc)]
                diffs.append(np.abs(z - shifted))
    with np.errstate(invalid="ignore"):
        tri = np.nanmean(np.stack(diffs), axis=0)
    return slope, tri, (ns + ew) / 2.0


def dataset(cell, name):
    path = ROOT / "data" / "tiles" / (cell["tile"] + ".hgt.gz")
    if not path.exists():
        raise FileNotFoundError(path.name + " is not downloaded")
    grid = read_tile(path)
    north, west = bounds(cell["tile"])
    z = cut(grid, north, west, float(cell["lat"]), float(cell["lon"]))
    slope, tri, res = measures(z, grid.shape[0], float(cell["lat"]))
    stats = {
        "dataset_id": "srtm_gl1_window",
        "planet": "earth",
        "tile": cell["tile"],
        "region": name,
        "data_type": "REAL_SCIENTIFIC_MEASUREMENT",
        "source_citation": "NASA SRTM GL1 1-arcsecond window %s at %.4f, %.4f (64 x 64 cells, %.0f m/px), measured by the screening pass" % (cell["tile"], cell["lat"], cell["lon"], res),
        "elevation_m": {
            "min": round(float(np.nanmin(z)), 1),
            "max": round(float(np.nanmax(z)), 1),
            "mean": round(float(np.nanmean(z)), 1),
            "std": round(float(np.nanstd(z)), 1),
        },
        "slope_deg": {"mean": round(float(np.nanmean(slope)), 2)},
    }
    return PlanetaryDataset(body="earth", region_id=cell["id"], elevation=z, slope=slope,
                            roughness=tri, stats=stats, resolution_m=res)


def summarise(doc, site_id, target):
    """Flatten a report into the shape the UI already consumes."""
    dims = []
    for dim_id, dim in doc["dimensions"].items():
        words = dim_id.replace("_", " ")
        dims.append({"id": dim_id, "label": words[:1].upper() + words[1:],
                     "status": dim.get("status", ""),
                     "similar": len(dim.get("similarities", [])),
                     "mismatched": len(dim.get("mismatches", [])),
                     "evidence": len(dim.get("evidence", []))})
    return {"siteId": site_id, "target": target, "framework": doc["framework"],
            "engineVersion": doc["engine_version"], "candidate": doc["location"]["name"],
            "targetRegion": doc["planetary_context"]["target_region"],
            "candidateResolutionM": doc["data_quality"]["candidate_resolution_m"],
            "targetResolutionM": doc["data_quality"]["target_resolution_m"],
            "uncertainties": doc["uncertainties"], "dimensions": dims}


def main():
    candidates = json.loads((ROOT / "reports" / "screened_candidates.json").read_text(encoding="utf-8"))["candidates"]
    places = {}
    places_path = ROOT / "config" / "screened_place_names.json"
    if places_path.exists():
        places = json.loads(places_path.read_text(encoding="utf-8")).get("places", {})

    out_dir = ROOT / "reports" / "engine"
    out_dir.mkdir(parents=True, exist_ok=True)
    targets = {"moon": load_moon_south_pole(), "mars": load_mars_jezero()}

    index, skipped = [], []
    print("Comparing %d screened windows against both targets\n" % len(candidates))
    for cell in candidates:
        name = places.get(cell["id"], {}).get("name") or cell["region"]
        try:
            candidate = dataset(cell, name)
        except FileNotFoundError as error:
            skipped.append({"siteId": cell["id"], "reason": str(error)})
            print("  !  %s: %s" % (cell["id"], error))
            continue
        for target_name, target in targets.items():
            path = export_report(ComparisonEngine.compare(candidate, target), output_dir=out_dir)
            index.append(summarise(json.loads(path.read_text(encoding="utf-8")), cell["id"], target_name))
            print("  ok %-22s vs %-4s -> %s" % (cell["id"], target_name, path.name))

    (ROOT / "reports" / "engine_index.json").write_text(json.dumps({
        "generated_by": "scripts/run_all_comparisons.py",
        "framework": index[0]["framework"] if index else "",
        "engine_version": index[0]["engineVersion"] if index else "",
        "candidate_count": len({e["siteId"] for e in index}),
        "pairs": len(index),
        "skipped": skipped,
        "candidates": index,
    }, indent=2), encoding="utf-8")
    print("\nWrote %d reports; index covers %d candidates, skipped %d" % (
        len(index), len({e["siteId"] for e in index}), len(skipped)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
