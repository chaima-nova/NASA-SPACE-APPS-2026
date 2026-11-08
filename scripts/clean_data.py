"""
scripts/clean_data.py
──────────────────────────────────────────────────────────────────────────────
Stage 4: Read raw data, clean, validate, and write to data/interim/.

For raster (IMG) files: reads PDS3 binary, applies scale/offset, masks nodata,
  converts to float32, writes GeoTIFF to interim/.
For JSON/CSV: cleans column names, flags missing/invalid values.

Usage:
  python scripts/clean_data.py
  python scripts/clean_data.py --dataset lola_64ppd
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

import numpy as np

from src.processing.pds_reader import read_pds3_img, img_to_geotiff
from src.processing.cleaner import ProcessingReport
from src.provenance.tracker import ProvenanceTracker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(ROOT / "reports" / "pipeline.log", mode="a"),
    ],
)
logger = logging.getLogger("clean_data")

PROV_FILE = ROOT / "reports" / "provenance.jsonl"
INTERIM_DIR = ROOT / "data" / "interim"


def clean_lola_64ppd(tracker: ProvenanceTracker) -> dict:
    """Convert LOLA IMG to cleaned GeoTIFF in interim/."""
    report = ProcessingReport("lola_64ppd")
    raw_dir = ROOT / "data" / "raw" / "moon" / "lola_64ppd"
    
    # Locate any downloaded LOLA IMG (e.g. ldem_4.img or ldem_64.img)
    img_candidates = list(raw_dir.glob("*.img")) + list((ROOT / "data" / "raw" / "moon" / "lola").glob("*.img"))
    if not img_candidates:
        msg = f"LOLA IMG not found in {raw_dir}. Run download_data.py first."
        report.log("check_input", msg)
        return {"dataset_id": "lola_64ppd", "status": "skipped_missing_input", "reason": msg}

    img_path = img_candidates[0]
    lbl_path = img_path.with_suffix(".lbl")
    if not lbl_path.exists():
        lbl_path = img_path.with_suffix(".LBL")

    report.log("read_pds3", str(img_path))

    # ── Read binary IMG ───────────────────────────────────────────────────
    read_result = read_pds3_img(img_path, lbl_path)
    if read_result["error"]:
        report.log("read_error", read_result["error"])
        return {"dataset_id": "lola_64ppd", "status": "error", "error": read_result["error"]}

    arr = read_result["data"]
    report.log("shape", arr.shape)
    report.log("value_range_m", [round(float(np.nanmin(arr)), 1), round(float(np.nanmax(arr)), 1)])
    report.log("nodata_pixels", int(np.isnan(arr).sum()))

    # ── Write cleaned GeoTIFF ─────────────────────────────────────────────
    out_dir = INTERIM_DIR / "moon"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{img_path.stem.lower()}_elevation_m.tif"

    convert = img_to_geotiff(
        img_path=img_path,
        lbl_path=lbl_path,
        out_path=out_path,
        planet="moon",
        west=read_result.get("img_west", 0.0),
        south=read_result.get("img_south", -90.0),
        east=read_result.get("img_east", 360.0),
        north=read_result.get("img_north", 90.0),
    )

    if convert["error"]:
        report.log("geotiff_error", convert["error"])
        return {"dataset_id": "lola_64ppd", "status": "error", "error": convert["error"]}

    tracker.record_processing(
        "lola_64ppd", "img_to_geotiff", input_path=img_path, output_path=out_path,
        detail={"shape": convert["shape"], "crs": convert["crs"]},
    )
    report.log("geotiff_written", str(out_path))

    return {
        "dataset_id": "lola_64ppd",
        "status": "success",
        "output": str(out_path),
        "shape": convert["shape"],
        "crs": convert["crs"],
        "report": report.to_dict(),
    }


def clean_mola_meg128(tracker: ProvenanceTracker) -> dict:
    """Convert MOLA MEGaDR IMG to cleaned GeoTIFF in interim/."""
    report = ProcessingReport("mola_meg128")
    raw_dir = ROOT / "data" / "raw" / "mars" / "mola_meg128"

    # Locate any downloaded MOLA IMG (e.g. megt90n000cb.img or megt90n000eb.img)
    img_candidates = list(raw_dir.glob("*.img"))
    if not img_candidates:
        msg = f"MOLA IMG not found in {raw_dir}. Run download_data.py first."
        report.log("check_input", msg)
        return {"dataset_id": "mola_meg128", "status": "skipped_missing_input", "reason": msg}

    img_path = img_candidates[0]
    lbl_path = img_path.with_suffix(".lbl")
    if not lbl_path.exists():
        lbl_path = img_path.with_suffix(".LBL")

    report.log("read_pds3", str(img_path))
    read_result = read_pds3_img(img_path, lbl_path)
    if read_result["error"]:
        return {"dataset_id": "mola_meg128", "status": "error", "error": read_result["error"]}

    arr = read_result["data"]
    report.log("shape", arr.shape)
    report.log("value_range_m", [round(float(np.nanmin(arr)), 1), round(float(np.nanmax(arr)), 1)])

    out_dir = INTERIM_DIR / "mars"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{img_path.stem.lower()}_elevation_m.tif"

    convert = img_to_geotiff(
        img_path=img_path,
        lbl_path=lbl_path,
        out_path=out_path,
        planet="mars",
        west=read_result.get("img_west", 0.0),
        south=read_result.get("img_south", -90.0),
        east=read_result.get("img_east", 360.0),
        north=read_result.get("img_north", 90.0),
    )

    if convert["error"]:
        return {"dataset_id": "mola_meg128", "status": "error", "error": convert["error"]}

    tracker.record_processing(
        "mola_meg128", "img_to_geotiff", input_path=img_path, output_path=out_path,
        detail={"shape": convert["shape"]},
    )

    return {
        "dataset_id": "mola_meg128",
        "status": "success",
        "output": str(out_path),
        "shape": convert["shape"],
        "crs": convert["crs"],
        "report": report.to_dict(),
    }


def clean_srtm_gl1(tracker: ProvenanceTracker) -> dict:
    """Read raw SRTM GL1 HGT raster and write cleaned GeoTIFF in interim/."""
    from src.processing.pds_reader import read_hgt_file
    report = ProcessingReport("srtm_gl1")
    raw_dir = ROOT / "data" / "raw" / "earth" / "srtm_gl1"

    hgt_candidates = list(raw_dir.glob("*.hgt"))
    if not hgt_candidates:
        msg = f"No .hgt file found in {raw_dir}. Run download_data.py first."
        report.log("check_input", msg)
        return {"dataset_id": "srtm_gl1", "status": "skipped_missing_input", "reason": msg}

    hgt_path = hgt_candidates[0]
    read_res = read_hgt_file(hgt_path)
    if read_res["error"]:
        return {"dataset_id": "srtm_gl1", "status": "error", "error": read_res["error"]}

    arr = read_res["data"]
    out_dir = INTERIM_DIR / "earth"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{hgt_path.stem.lower()}_elevation_m.tif"

    try:
        import rasterio
        from rasterio.crs import CRS
        from rasterio.transform import from_bounds
        transform = from_bounds(
            read_res["west"], read_res["south"], read_res["east"], read_res["north"],
            read_res["ncols"], read_res["nrows"],
        )
        with rasterio.open(
            out_path, "w", driver="GTiff",
            height=read_res["nrows"], width=read_res["ncols"],
            count=1, dtype=rasterio.float32,
            crs=CRS.from_epsg(4326), transform=transform,
            nodata=np.nan, compress="lzw",
        ) as dst:
            dst.write(arr, 1)

        tracker.record_processing("srtm_gl1", "hgt_to_geotiff", input_path=hgt_path, output_path=out_path)
        return {
            "dataset_id": "srtm_gl1",
            "status": "success",
            "output": str(out_path),
            "shape": arr.shape,
            "crs": "EPSG:4326",
            "elevation_range_m": [float(np.nanmin(arr)), float(np.nanmax(arr))],
        }
    except Exception as exc:
        return {"dataset_id": "srtm_gl1", "status": "error", "error": str(exc)}


def clean_apod(tracker: ProvenanceTracker) -> dict:
    """Clean and validate APOD JSON metadata."""
    import pandas as pd
    from src.processing.cleaner import normalise_columns

    raw_path = ROOT / "data" / "raw" / "misc" / "apod" / "apod_latest.json"
    if not raw_path.exists():
        return {"dataset_id": "nasa_api_apod", "status": "skipped_missing_input"}

    with open(raw_path, encoding="utf-8") as fh:
        apod_data = json.load(fh)

    # Convert single dict to 1-row DataFrame
    df = pd.DataFrame([apod_data])
    df = normalise_columns(df)

    out_dir = INTERIM_DIR / "misc"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "apod_cleaned.csv"
    df.to_csv(out_path, index=False)

    tracker.record_processing("nasa_api_apod", "json_to_csv", input_path=raw_path, output_path=out_path)

    return {
        "dataset_id": "nasa_api_apod",
        "status": "success",
        "output": str(out_path),
        "columns": list(df.columns),
    }


CLEANERS = {
    "srtm_gl1": clean_srtm_gl1,
    "lola_64ppd": clean_lola_64ppd,
    "mola_meg128": clean_mola_meg128,
    "nasa_api_apod": clean_apod,
}


def main(args: argparse.Namespace) -> dict:
    tracker = ProvenanceTracker(PROV_FILE)
    results = []

    for ds_id, fn in CLEANERS.items():
        if args.dataset and ds_id != args.dataset:
            continue
        logger.info("Cleaning: %s", ds_id)
        result = fn(tracker)
        results.append(result)
        if result["status"] == "success":
            logger.info("  [OK] %s -> %s", ds_id, result.get("output", ""))
        elif "skip" in result["status"]:
            logger.info("  [SKIP] %s: %s", ds_id, result.get("reason", ""))
        else:
            logger.error("  [FAIL] %s: %s", ds_id, result.get("error", ""))

    report_path = ROOT / "reports" / "cleaning_report.json"
    with open(report_path, "w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2)

    return {"results": results, "report": str(report_path)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clean raw data into interim products")
    parser.add_argument("--dataset", default=None, help="Clean only this dataset ID")
    args = parser.parse_args()

    out = main(args)
    print("\n" + "=" * 60)
    print("CLEANING REPORT")
    print("=" * 60)
    for r in out["results"]:
        icon = "[OK]" if r["status"] == "success" else ("[SKIP]" if "skip" in r["status"] else "[FAIL]")
        print(f"  {icon:6s} {r['dataset_id']:30s} -> {r['status']}")
    print("=" * 60)

