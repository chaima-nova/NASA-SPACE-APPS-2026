"""
scripts/discover_datasets.py
──────────────────────────────────────────────────────────────────────────────
Stage 1: Verify reachability of all enabled dataset endpoints.
Runs lightweight HEAD/GET checks – no full downloads.

Output:
  reports/discovery_report.json

Usage:
  python scripts/discover_datasets.py
  python scripts/discover_datasets.py --dataset lola_64ppd
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

# ── Ensure project root is on path ────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from src.ingestion.base import check_url_accessible
from src.ingestion.nasa_api import fetch_apod, get_api_key
from src.ingestion.pds import check_lola_accessible, check_mola_accessible

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(ROOT / "reports" / "pipeline.log", mode="a"),
    ],
)
logger = logging.getLogger("discover_datasets")


def load_datasets_config() -> list[dict]:
    cfg_path = ROOT / "config" / "datasets.json"
    with open(cfg_path, encoding="utf-8") as fh:
        cfg = json.load(fh)
    return cfg["datasets"]


def discover_all(filter_id: str | None = None) -> dict:
    datasets = load_datasets_config()
    results = []

    for ds in datasets:
        if not ds.get("enabled", False):
            logger.info("SKIP (disabled): %s", ds["id"])
            results.append({
                "id": ds["id"],
                "name": ds["name"],
                "planet": ds.get("planetary_body"),
                "status": "disabled",
                "accessible": None,
                "note": "Dataset disabled in config/datasets.json",
            })
            continue

        if filter_id and ds["id"] != filter_id:
            continue

        ds_id = ds["id"]
        endpoint = ds.get("download_endpoint", "")
        auth_req = ds.get("authentication_required", False)

        logger.info("Checking: %s", ds_id)

        entry = {
            "id": ds_id,
            "name": ds["name"],
            "planet": ds.get("planetary_body"),
            "endpoint": endpoint,
            "auth_required": auth_req,
            "accessible": None,
            "status_code": None,
            "content_length": None,
            "error": None,
            "status": "unknown",
        }

        # ── Special check for NASA API ────────────────────────────────────
        if ds.get("access_method") == "rest_api" and "api.nasa.gov" in endpoint:
            apod = fetch_apod()
            if isinstance(apod, dict) and apod.get("data"):
                entry["accessible"] = True
                entry["status"] = "api_reachable"
                entry["note"] = f"NASA API key: {get_api_key()[:8]}... APOD title: {apod['data'].get('title', 'N/A')}"
            elif isinstance(apod, dict) and apod.get("error"):
                entry["accessible"] = False
                entry["status"] = "api_error"
                entry["error"] = apod["error"]
            else:
                entry["accessible"] = True
                entry["status"] = "api_reachable"
            results.append(entry)
            continue

        # ── Generic HEAD check ────────────────────────────────────────────
        if not endpoint:
            entry["status"] = "no_endpoint"
            entry["note"] = "No download endpoint configured"
            results.append(entry)
            continue

        check = check_url_accessible(endpoint)
        entry["accessible"] = check["accessible"]
        entry["status_code"] = check["status_code"]
        entry["content_length"] = check["content_length"]
        entry["error"] = check.get("error")

        if check["accessible"]:
            if auth_req:
                entry["status"] = "reachable_auth_required"
                entry["note"] = f"Endpoint reachable but auth needed. Method: {ds.get('auth_method', 'see config')}"
            else:
                entry["status"] = "reachable_public"
        elif check["status_code"] == 401:
            entry["status"] = "auth_required"
            entry["note"] = "HTTP 401 – needs credentials"
        elif check["status_code"] == 404:
            entry["status"] = "not_found"
            entry["note"] = "HTTP 404 – URL may have changed"
        elif check.get("error"):
            entry["status"] = "connection_error"
        else:
            entry["status"] = f"http_{check['status_code']}"

        results.append(entry)

    # ── Summary ────────────────────────────────────────────────────────────
    reachable = [r for r in results if r.get("accessible")]
    auth_only = [r for r in results if r["status"] in ("auth_required", "reachable_auth_required")]
    errors = [r for r in results if r.get("error") and not r.get("accessible")]

    report = {
        "total_datasets": len(results),
        "reachable_public": len([r for r in results if r["status"] == "reachable_public"]),
        "reachable_auth_required": len(auth_only),
        "api_reachable": len([r for r in results if r["status"] == "api_reachable"]),
        "disabled": len([r for r in results if r["status"] == "disabled"]),
        "errors": len(errors),
        "datasets": results,
    }

    out = ROOT / "reports" / "discovery_report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)

    logger.info("Discovery complete: %d datasets checked", len(results))
    logger.info("  Publicly reachable: %d", report["reachable_public"])
    logger.info("  Needs auth:         %d", report["reachable_auth_required"])
    logger.info("  API reachable:      %d", report["api_reachable"])
    logger.info("  Errors:             %d", report["errors"])
    logger.info("Report written: %s", out)

    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Discover and verify dataset endpoints")
    parser.add_argument("--dataset", help="Check only a specific dataset ID", default=None)
    args = parser.parse_args()

    report = discover_all(filter_id=args.dataset)

    # Print summary to terminal
    print("\n" + "=" * 60)
    print("DATASET DISCOVERY REPORT")
    print("=" * 60)
    for ds in report["datasets"]:
        icon = "[OK]" if ds.get("accessible") else ("[SKIP]" if ds["status"] == "disabled" else "[WARN]" if "auth" in ds["status"] else "[FAIL]")
        print(f"  {icon:6s} [{ds['planet']:6s}] {ds['id']:25s} -> {ds['status']}")
    print("=" * 60)
    print("Saved: reports/discovery_report.json")

