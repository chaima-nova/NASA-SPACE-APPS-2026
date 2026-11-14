"""
scripts/inspect_data.py
──────────────────────────────────────────────────────────────────────────────
Stage 3: Inspect raw downloaded files – report format, size, schema, stats.
Does not modify any files.

Usage:
  python scripts/inspect_data.py
  python scripts/inspect_data.py --dir data/raw/moon/lola_64ppd
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("inspect_data")


def inspect_directory(directory: Path) -> list[dict]:
    """Walk a directory and inspect each known file type."""
    reports = []
    for path in sorted(directory.rglob("*")):
        if not path.is_file():
            continue
        suffix = path.suffix.lower()

        if suffix in (".img", ".bil", ".raw"):
            reports.append(inspect_binary_img(path))
        elif suffix == ".hgt":
            reports.append(inspect_hgt(path))
        elif suffix == ".lbl":
            reports.append(inspect_pds_label(path))
        elif suffix in (".tif", ".tiff"):
            reports.append(inspect_geotiff(path))
        elif suffix == ".nc":
            reports.append(inspect_netcdf(path))
        elif suffix == ".json":
            reports.append(inspect_json(path))
        elif suffix == ".csv":
            reports.append(inspect_csv(path))
        elif suffix == ".npy":
            reports.append(inspect_npy(path))
        else:
            reports.append({
                "file": str(path),
                "type": suffix,
                "size_mb": round(path.stat().st_size / 1_048_576, 2),
                "notes": "Format not auto-inspected",
            })
    return reports


def inspect_hgt(path: Path) -> dict:
    from src.processing.pds_reader import read_hgt_file
    res = read_hgt_file(path)
    size_mb = path.stat().st_size / 1_048_576
    report = {
        "file": str(path),
        "type": "SRTM/NASADEM HGT binary",
        "size_mb": round(size_mb, 2),
        "rows": res.get("nrows"),
        "cols": res.get("ncols"),
        "resolution_deg": res.get("resolution_deg"),
        "bbox": [res.get("west"), res.get("south"), res.get("east"), res.get("north")],
    }
    arr = res.get("data")
    if arr is not None:
        report["shape"] = list(arr.shape)
        report["valid_pixels"] = int(np.sum(~np.isnan(arr)))
        report["nodata_pixels"] = int(np.sum(np.isnan(arr)))
        report["min_m"] = round(float(np.nanmin(arr)), 2)
        report["max_m"] = round(float(np.nanmax(arr)), 2)
        report["mean_m"] = round(float(np.nanmean(arr)), 2)
    return report


def inspect_binary_img(path: Path) -> dict:
    size_mb = path.stat().st_size / 1_048_576

    report = {"file": str(path), "type": "PDS3 IMG binary", "size_mb": round(size_mb, 2)}

    # Try to read label
    lbl = path.with_suffix(".LBL")
    if not lbl.exists():
        lbl = path.with_suffix(".lbl")

    if lbl.exists():
        from src.processing.pds_reader import parse_pds3_label, read_pds3_img
        label = parse_pds3_label(lbl)
        report["rows"] = label.get("LINES", "unknown")
        report["cols"] = label.get("LINE_SAMPLES", "unknown")
        report["sample_bits"] = label.get("SAMPLE_BITS", "unknown")
        report["sample_type"] = label.get("SAMPLE_TYPE", "unknown")
        report["scaling_factor"] = label.get("SCALING_FACTOR", "1.0")
        report["offset"] = label.get("OFFSET", "0.0")

        # Quick stats on a small sample (read just first 1000 rows)
        try:
            read = read_pds3_img(path, lbl)
            if read["data"] is not None:
                arr = read["data"]
                report["shape"] = list(arr.shape)
                report["valid_pixels"] = int(np.sum(~np.isnan(arr)))
                report["nodata_pixels"] = int(np.sum(np.isnan(arr)))
                report["min_m"] = round(float(np.nanmin(arr)), 2)
                report["max_m"] = round(float(np.nanmax(arr)), 2)
                report["mean_m"] = round(float(np.nanmean(arr)), 2)
        except Exception as exc:
            report["read_error"] = str(exc)
    else:
        report["notes"] = "No .LBL label file found alongside .IMG"

    return report


def inspect_pds_label(path: Path) -> dict:
    size = path.stat().st_size
    try:
        with open(path, "r", encoding="latin-1", errors="replace") as fh:
            text = fh.read()
        return {
            "file": str(path),
            "type": "PDS3 label",
            "size_bytes": size,
            "preview": text[:500],
        }
    except Exception as exc:
        return {"file": str(path), "type": "PDS3 label", "error": str(exc)}


def inspect_geotiff(path: Path) -> dict:
    report = {"file": str(path), "type": "GeoTIFF", "size_mb": round(path.stat().st_size / 1_048_576, 2)}
    try:
        import rasterio
        with rasterio.open(path) as src:
            report["shape"] = [src.height, src.width]
            report["bands"] = src.count
            report["crs"] = str(src.crs)
            report["bounds"] = list(src.bounds)
            report["dtype"] = str(src.dtypes[0])
            arr = src.read(1, masked=True)
            report["min"] = round(float(arr.min()), 2)
            report["max"] = round(float(arr.max()), 2)
            report["mean"] = round(float(arr.mean()), 2)
    except Exception as exc:
        report["error"] = str(exc)
    return report


def inspect_netcdf(path: Path) -> dict:
    report = {"file": str(path), "type": "NetCDF", "size_mb": round(path.stat().st_size / 1_048_576, 2)}
    try:
        import netCDF4 as nc
        with nc.Dataset(path, "r") as ds:
            report["dimensions"] = {k: len(v) for k, v in ds.dimensions.items()}
            report["variables"] = list(ds.variables.keys())
    except Exception as exc:
        report["error"] = str(exc)
    return report


def inspect_json(path: Path) -> dict:
    report = {"file": str(path), "type": "JSON", "size_bytes": path.stat().st_size}
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        report["top_level_keys"] = list(data.keys()) if isinstance(data, dict) else f"list[{len(data)}]"
    except Exception as exc:
        report["error"] = str(exc)
    return report


def inspect_csv(path: Path) -> dict:
    import pandas as pd
    report = {"file": str(path), "type": "CSV", "size_bytes": path.stat().st_size}
    try:
        df = pd.read_csv(path, nrows=5)
        report["columns"] = list(df.columns)
        report["preview_rows"] = 5
        full = pd.read_csv(path)
        report["total_rows"] = len(full)
        report["dtypes"] = {c: str(t) for c, t in full.dtypes.items()}
    except Exception as exc:
        report["error"] = str(exc)
    return report


def inspect_npy(path: Path) -> dict:
    report = {"file": str(path), "type": "numpy .npy", "size_mb": round(path.stat().st_size / 1_048_576, 2)}
    try:
        arr = np.load(path)
        report["shape"] = list(arr.shape)
        report["dtype"] = str(arr.dtype)
        report["min"] = round(float(np.nanmin(arr)), 2)
        report["max"] = round(float(np.nanmax(arr)), 2)
    except Exception as exc:
        report["error"] = str(exc)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Inspect downloaded raw data files")
    parser.add_argument("--dir", default="data/raw", help="Directory to inspect (default: data/raw)")
    args = parser.parse_args()

    target = ROOT / args.dir
    if not target.exists():
        print(f"Directory not found: {target}")
        sys.exit(1)

    logger.info("Inspecting: %s", target)
    reports = inspect_directory(target)

    if not reports:
        print("No files found in", target)
    else:
        out = ROOT / "reports" / "inspection_report.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(reports, fh, indent=2)

        print(f"\nInspected {len(reports)} files:")
        for r in reports:
            p = Path(r["file"]).relative_to(ROOT)
            typ = r.get("type", "?")
            size = r.get("size_mb", r.get("size_bytes", "?"))
            shape = r.get("shape", r.get("rows", ""))
            print(f"  {p}  [{typ}]  size={size}  shape={shape}")

        print(f"\nFull report: {out}")
