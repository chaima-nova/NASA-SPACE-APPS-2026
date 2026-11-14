"""
src/processing/sample_builder.py
Build small, scientifically representative sample datasets from raw data.

Outputs:
  - CSV tables (for tabular/point data)
  - Cropped GeoTIFF (for raster data, with spatial metadata preserved)
  - JSON statistics summary
  - Data dictionary CSV
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Raster sampler
# ---------------------------------------------------------------------------

def sample_raster_region(
    data: np.ndarray,
    row_start: int,
    row_end: int,
    col_start: int,
    col_end: int,
    dataset_id: str,
    planet: str,
    variable: str,
    units: str,
    west: float,
    south: float,
    east: float,
    north: float,
    out_dir: Path,
) -> dict:
    """
    Extract a regional subset from a 2D array and save as:
      - Numpy .npy file (lossless)
      - CSV of gridded values with lon/lat columns
      - JSON statistics

    Args:
        data: Full 2D float32 array
        row_start/end, col_start/end: Pixel indices of region
        dataset_id, planet, variable, units: Metadata
        west/south/east/north: Geographic extent of the FULL array
        out_dir: Output directory

    Returns:
        Dict with output file paths and statistics
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    subset = data[row_start:row_end, col_start:col_end].copy()
    nrows, ncols = subset.shape

    result: dict = {
        "dataset_id": dataset_id,
        "planet": planet,
        "variable": variable,
        "units": units,
        "region_bbox": [west, south, east, north],
        "shape": list(subset.shape),
        "files": {},
        "statistics": {},
    }

    valid = subset[~np.isnan(subset)]
    if valid.size > 0:
        stats = {
            "count_valid": int(valid.size),
            "count_nodata": int(np.isnan(subset).sum()),
            "min": float(np.nanmin(subset)),
            "max": float(np.nanmax(subset)),
            "mean": float(np.nanmean(subset)),
            "std": float(np.nanstd(subset)),
            "p10": float(np.nanpercentile(subset, 10)),
            "p50": float(np.nanpercentile(subset, 50)),
            "p90": float(np.nanpercentile(subset, 90)),
        }
    else:
        stats = {"count_valid": 0, "count_nodata": int(subset.size)}

    result["statistics"] = stats

    # ── CSV output ─────────────────────────────────────────────────────────
    # Build lon/lat for each pixel centre
    full_nrows, full_ncols = data.shape
    res_lon = (east - west) / full_ncols  # This uses the FULL array extent
    res_lat = (north - south) / full_nrows

    # Pixel centres for the subset
    lons = west + (col_start + np.arange(ncols) + 0.5) * res_lon
    lats = north - (row_start + np.arange(nrows) + 0.5) * res_lat

    lon_grid, lat_grid = np.meshgrid(lons, lats)
    df = pd.DataFrame({
        "latitude": lat_grid.ravel(),
        "longitude": lon_grid.ravel(),
        variable: subset.ravel(),
    })
    df[variable] = df[variable].where(~np.isnan(df[variable]), other=np.nan)

    csv_path = out_dir / f"{dataset_id}_{planet}_sample.csv"
    df.to_csv(csv_path, index=False, float_format="%.4f")
    result["files"]["csv"] = str(csv_path)
    logger.info("Saved sample CSV: %s (%d rows)", csv_path.name, len(df))

    # ── Numpy binary ───────────────────────────────────────────────────────
    npy_path = out_dir / f"{dataset_id}_{planet}_sample.npy"
    np.save(npy_path, subset)
    result["files"]["npy"] = str(npy_path)

    # ── Statistics JSON ────────────────────────────────────────────────────
    stats_path = out_dir / f"{dataset_id}_{planet}_stats.json"
    with open(stats_path, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2)
    result["files"]["stats_json"] = str(stats_path)

    return result


# ---------------------------------------------------------------------------
# Data dictionary builder
# ---------------------------------------------------------------------------

def build_data_dictionary(
    field_specs: list[dict],
    out_path: Path,
) -> None:
    """
    Write a data dictionary CSV.

    Args:
        field_specs: List of dicts with keys:
            field_name, description, units, dtype, valid_range, nodata_value,
            source, notes
        out_path: Output CSV path
    """
    columns = [
        "field_name", "description", "units", "dtype",
        "valid_range", "nodata_value", "source", "notes",
    ]
    rows = []
    for spec in field_specs:
        row = {col: spec.get(col, "") for col in columns}
        rows.append(row)

    df = pd.DataFrame(rows, columns=columns)
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False)
    logger.info("Written data dictionary: %s", out_path.name)


# ---------------------------------------------------------------------------
# Python loading example generator
# ---------------------------------------------------------------------------

def write_loading_example(
    dataset_id: str,
    planet: str,
    csv_path: Path,
    out_path: Path,
    variable: str,
    units: str,
) -> None:
    """Write a self-contained Python loading example as a .py file."""
    code = f'''"""
Loading example for: {dataset_id} ({planet})
Variable: {variable}  |  Units: {units}
Generated by the NASA Space Apps Data Pipeline
"""
import pandas as pd
import numpy as np

# ── Load sample CSV ────────────────────────────────────────────────────────
df = pd.read_csv(r"{csv_path}")
print(df.head())
print(f"\\nShape: {{df.shape}}")
print(f"\\nStatistics:\\n{{df['{variable}'].describe()}}")

# ── Filter out nodata ──────────────────────────────────────────────────────
valid = df.dropna(subset=['{variable}'])
print(f"\\nValid pixels: {{len(valid)}} / {{len(df)}}")

# ── Basic regional query: find highest elevation pixels ───────────────────
if '{variable}' in df.columns:
    top10 = valid.nlargest(10, '{variable}')
    print("\\nTop 10 highest {variable} ({units}):")
    print(top10[['latitude', 'longitude', '{variable}']].to_string(index=False))
'''
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(code)
    logger.info("Written loading example: %s", out_path.name)
