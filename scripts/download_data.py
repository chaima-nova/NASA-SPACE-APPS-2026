"""
scripts/download_data.py
──────────────────────────────────────────────────────────────────────────────
Stage 2: Download raw data files for enabled datasets.

What is actually downloaded:
  - LOLA 64ppd lunar DEM (IMG + LBL, ~50 MB, public)
  - MOLA MEGaDR 128ppd Mars DEM (IMG + LBL, ~224 MB, public)  [--skip-large to omit]
  - NASA APOD API response (JSON metadata, small, API key)

What requires NASA Earthdata credentials (NOT downloaded automatically):
  - SRTM GL1 tiles
  - MODIS LST
  - MODIS Land Cover
  → These are documented; connector code exists; set credentials in .env to activate.

Usage:
  python scripts/download_data.py                 # Download all enabled datasets
  python scripts/download_data.py --dataset lola_64ppd
  python scripts/download_data.py --skip-large    # Skip files > 100 MB
  python scripts/download_data.py --dry-run       # Report what would be downloaded
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

from src.ingestion.nasa_api import fetch_apod
from src.ingestion.pds import download_lola_64ppd, download_mola_meg128
from src.ingestion.earthdata import verify_credentials
from src.provenance.tracker import ProvenanceTracker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(ROOT / "reports" / "pipeline.log", mode="a"),
    ],
)
logger = logging.getLogger("download_data")

PROV_FILE = ROOT / "reports" / "provenance.jsonl"
INGESTION_REPORT = ROOT / "reports" / "ingestion_report.json"


def load_config() -> tuple[dict, list[dict]]:
    with open(ROOT / "config" / "settings.json", encoding="utf-8") as fh:
        settings = json.load(fh)
    with open(ROOT / "config" / "datasets.json", encoding="utf-8") as fh:
        datasets = json.load(fh)["datasets"]
    return settings, datasets


def main(args: argparse.Namespace) -> dict:
    settings, datasets = load_config()
    tracker = ProvenanceTracker(PROV_FILE)

    max_size_mb = 100 if args.skip_large else settings["download_limits"]["max_file_size_mb"]
    filter_id = args.dataset

    results: list[dict] = []
    skipped_auth: list[str] = []

    for ds in datasets:
        ds_id = ds["id"]

        if not ds.get("enabled", False):
            logger.info("SKIP (disabled): %s", ds_id)
            continue

        if filter_id and ds_id != filter_id:
            continue

        # ── Size gate ──────────────────────────────────────────────────────
        size_str = ds.get("expected_size", ds.get("expected_size_per_tile", "unknown"))
        try:
            # Quick parse: extract first number from size string
            import re
            m = re.search(r"([\d.]+)\s*(MB|GB|KB)", size_str, re.IGNORECASE)
            if m:
                num, unit = float(m.group(1)), m.group(2).upper()
                size_mb = num * (1024 if unit == "GB" else (1/1024 if unit == "KB" else 1))
                if size_mb > max_size_mb:
                    logger.warning(
                        "SKIP (too large, %.0f MB > limit %.0f MB): %s",
                        size_mb, max_size_mb, ds_id,
                    )
                    results.append({
                        "dataset_id": ds_id, "status": "skipped_size",
                        "reason": f"File too large ({size_mb:.0f} MB > {max_size_mb} MB limit)"
                    })
                    continue
        except Exception:
            pass

        # ── Auth check ────────────────────────────────────────────────────
        if ds.get("authentication_required") and ds.get("access_method") in (
            "earthdata_https", "earthdata_opendap"
        ):
            cred_check = verify_credentials()
            if cred_check["status"] != "ok":
                logger.warning(
                    "SKIP (auth required, no valid credentials): %s", ds_id
                )
                skipped_auth.append(ds_id)
                results.append({
                    "dataset_id": ds_id,
                    "status": "skipped_auth_required",
                    "reason": f"NASA Earthdata credentials needed. {cred_check['message']}",
                    "setup_instructions": (
                        "1. Register at https://urs.earthdata.nasa.gov/\n"
                        "2. Copy .env.example to .env\n"
                        "3. Fill in NASA_EARTHDATA_USERNAME and NASA_EARTHDATA_PASSWORD\n"
                        "4. Re-run: python scripts/download_data.py"
                    ),
                })
                continue

        raw_dir = ROOT / ds.get("local_raw_dir", f"data/raw/{ds.get('planetary_body', 'misc')}/{ds_id}")

        if args.dry_run:
            logger.info("[DRY RUN] Would download: %s → %s", ds_id, raw_dir)
            results.append({"dataset_id": ds_id, "status": "dry_run", "dest": str(raw_dir)})
            continue

        # ── Dataset-specific downloaders ──────────────────────────────────
        t0 = time.time()

        if ds_id == "lola_64ppd":
            logger.info("Downloading LOLA 64ppd lunar DEM...")
            records = download_lola_64ppd(raw_dir, skip_if_exists=True, provenance_file=PROV_FILE)
            for r in records:
                tracker.record_download(ds_id, r)
            success = any(r["status"] in ("success", "skipped_existing") for r in records)
            results.append({
                "dataset_id": ds_id,
                "status": "success" if success else "error",
                "files": [r.get("dest_path") for r in records],
                "elapsed_s": round(time.time() - t0, 1),
            })

        elif ds_id == "mola_meg128":
            logger.info("Downloading MOLA MEGaDR 128ppd Mars DEM...")
            records = download_mola_meg128(raw_dir, skip_if_exists=True, provenance_file=PROV_FILE)
            for r in records:
                tracker.record_download(ds_id, r)
            success = any(r["status"] in ("success", "skipped_existing") for r in records)
            results.append({
                "dataset_id": ds_id,
                "status": "success" if success else "error",
                "files": [r.get("dest_path") for r in records],
                "elapsed_s": round(time.time() - t0, 1),
            })

        elif ds_id == "srtm_gl1":
            logger.info("Downloading SRTM GL1 Earth elevation tile for Atacama analogue...")
            from src.ingestion.earthdata import download_earth_srtm_tile
            rec = download_earth_srtm_tile(
                tile_id="S24W069",
                dest_dir=raw_dir,
                skip_if_exists=True,
                provenance_file=PROV_FILE,
            )
            tracker.record_download(ds_id, rec)
            success = rec.get("status") in ("success", "skipped_existing")
            results.append({
                "dataset_id": ds_id,
                "status": "success" if success else "error",
                "files": [rec.get("dest_path"), rec.get("decompressed_hgt")],
                "elapsed_s": round(time.time() - t0, 1),
            })

        elif ds_id == "nasa_api_apod":
            logger.info("Fetching NASA APOD...")
            dest = raw_dir / "apod_latest.json"
            dest.parent.mkdir(parents=True, exist_ok=True)
            record = fetch_apod(dest_file=dest)
            tracker.record_download(ds_id, record if isinstance(record, dict) else {})
            success = dest.exists() and dest.stat().st_size > 0
            results.append({
                "dataset_id": ds_id,
                "status": "success" if success else "error",
                "file": str(dest),
                "elapsed_s": round(time.time() - t0, 1),
            })

        else:
            logger.warning("No downloader implemented for: %s (access_method=%s)", ds_id, ds.get("access_method"))
            results.append({
                "dataset_id": ds_id,
                "status": "not_implemented",
                "note": f"Connector for '{ds.get('access_method')}' not yet implemented for this dataset",
            })

    # ── Write ingestion report ─────────────────────────────────────────────
    report = {
        "run_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "datasets_processed": len([r for r in results if r["status"] not in ("dry_run",)]),
        "successful": [r["dataset_id"] for r in results if r["status"] == "success"],
        "skipped_auth": skipped_auth,
        "skipped_size": [r["dataset_id"] for r in results if r["status"] == "skipped_size"],
        "errors": [r for r in results if "error" in r["status"]],
        "results": results,
    }
    INGESTION_REPORT.parent.mkdir(parents=True, exist_ok=True)
    with open(INGESTION_REPORT, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)

    tracker.finalize(report)

    logger.info("Ingestion complete. Successful: %s", report["successful"])
    if skipped_auth:
        logger.warning("Datasets skipped (need credentials): %s", skipped_auth)

    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download raw NASA datasets")
    parser.add_argument("--dataset", help="Download only this dataset ID", default=None)
    parser.add_argument("--skip-large", action="store_true", help="Skip files > 100 MB")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be downloaded without downloading")
    args = parser.parse_args()

    report = main(args)

    print("\n" + "=" * 60)
    print("INGESTION REPORT")
    print("=" * 60)
    for r in report["results"]:
        icon = "[OK]" if r["status"] == "success" else ("[SKIP]" if "skip" in r["status"] else "[FAIL]")
        print(f"  {icon:6s} {r['dataset_id']:30s} -> {r['status']}")
    if report["skipped_auth"]:
        print(f"\n[INFO] {len(report['skipped_auth'])} datasets need NASA Earthdata credentials.")
        print("   See .env.example and register at https://urs.earthdata.nasa.gov/")
    print("=" * 60)
    print(f"Saved: {INGESTION_REPORT}")

