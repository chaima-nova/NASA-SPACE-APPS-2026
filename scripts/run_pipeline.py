"""
scripts/run_pipeline.py
──────────────────────────────────────────────────────────────────────────────
Master orchestrator: runs the complete pipeline end-to-end.

  Stage 1: Discover  – verify dataset endpoint reachability
  Stage 2: Download  – retrieve raw data files
  Stage 3: Clean     – convert and standardise raw data
  Stage 4: Samples   – build sample datasets for teammates
  Stage 5: Validate  – run all validation checks
  Stage 6: Report    – compile final pipeline report

Usage:
  python scripts/run_pipeline.py                     # full pipeline
  python scripts/run_pipeline.py --skip-large        # skip files > 100 MB
  python scripts/run_pipeline.py --stage discover    # run only discovery
  python scripts/run_pipeline.py --stage download    # run only download
  python scripts/run_pipeline.py --stage clean       # run only cleaning
  python scripts/run_pipeline.py --stage samples     # run only sample build
  python scripts/run_pipeline.py --stage validate    # run only validation
  python scripts/run_pipeline.py --dry-run           # discover + dry-run download
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

# Ensure reports dir exists before setting up file handler
(ROOT / "reports").mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(ROOT / "reports" / "pipeline.log", mode="a"),
    ],
)
logger = logging.getLogger("run_pipeline")

FINAL_REPORT_PATH = ROOT / "reports" / "final_pipeline_report.json"


def run_stage(name: str, module_fn, *fn_args, **fn_kwargs) -> dict:
    """Run a pipeline stage function and return a result dict."""
    logger.info("=" * 60)
    logger.info("STAGE: %s", name.upper())
    logger.info("=" * 60)
    t0 = time.time()
    try:
        result = module_fn(*fn_args, **fn_kwargs)
        elapsed = round(time.time() - t0, 1)
        logger.info("Stage '%s' completed in %.1f s", name, elapsed)
        return {"stage": name, "status": "success", "elapsed_s": elapsed, "result": result}
    except Exception as exc:  # noqa: BLE001
        elapsed = round(time.time() - t0, 1)
        logger.exception("Stage '%s' FAILED: %s", name, exc)
        return {"stage": name, "status": "error", "elapsed_s": elapsed, "error": str(exc)}


def main(args: argparse.Namespace) -> dict:
    pipeline_start = time.time()
    stage_results = []

    all_stages = args.stage is None  # None means run all

    # ── Stage 1: Discover ─────────────────────────────────────────────────
    if all_stages or args.stage == "discover":
        from scripts.discover_datasets import discover_all
        stage_results.append(run_stage("discover", discover_all))

    # ── Stage 2: Download ─────────────────────────────────────────────────
    if all_stages or args.stage == "download":
        import scripts.download_data as dl_mod

        class FakeArgs:
            dataset = None
            skip_large = args.skip_large
            dry_run = args.dry_run

        stage_results.append(run_stage("download", dl_mod.main, FakeArgs()))

    # ── Stage 3: Clean ────────────────────────────────────────────────────
    if all_stages or args.stage == "clean":
        if not args.dry_run:
            import scripts.clean_data as clean_mod

            class FakeArgs2:
                dataset = None

            stage_results.append(run_stage("clean", clean_mod.main, FakeArgs2()))
        else:
            logger.info("Skipping clean stage (dry-run)")

    # ── Stage 4: Samples ──────────────────────────────────────────────────
    if all_stages or args.stage == "samples":
        if not args.dry_run:
            import scripts.build_samples as samples_mod

            class FakeArgs3:
                dataset = None

            stage_results.append(run_stage("samples", samples_mod.main, FakeArgs3()))
        else:
            logger.info("Skipping samples stage (dry-run)")

    # ── Stage 5: Validate ─────────────────────────────────────────────────
    if all_stages or args.stage == "validate":
        import scripts.validate_data as val_mod
        stage_results.append(run_stage("validate", val_mod.run_all_checks))

    # ── Compile final report ──────────────────────────────────────────────
    elapsed_total = round(time.time() - pipeline_start, 1)
    errors = [s for s in stage_results if s["status"] == "error"]
    warnings = []

    # Collect files created
    files_created = []
    for path in (ROOT / "data" / "samples").glob("*"):
        if path.is_file():
            files_created.append(str(path.relative_to(ROOT)))
    for path in (ROOT / "reports").glob("*.json"):
        files_created.append(str(path.relative_to(ROOT)))

    # Count records processed
    ingestion_report = ROOT / "reports" / "ingestion_report.json"
    ingestion_summary = {}
    if ingestion_report.exists():
        with open(ingestion_report, encoding="utf-8") as fh:
            ing = json.load(fh)
            ingestion_summary = {
                "successful_datasets": ing.get("successful", []),
                "skipped_auth": ing.get("skipped_auth", []),
            }

    final_report = {
        "pipeline_version": "1.0",
        "run_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_elapsed_s": elapsed_total,
        "overall_status": "PASS" if not errors else "FAIL",
        "stages": stage_results,
        "errors": errors,
        "warnings": warnings,
        "files_created": sorted(files_created),
        "ingestion_summary": ingestion_summary,
        "known_limitations": [
            "SRTM/MODIS Earth data requires NASA Earthdata credentials (not downloaded)",
            "MOLA 128ppd file is ~224 MB – skipped with --skip-large",
            "Earth sample is SYNTHETIC until credentials are provided",
            "Three challenge focus areas not yet confirmed – see config/settings.json",
            "MCS Mars temperature data not implemented (complex binary format)",
            "CTX image mosaic not implemented (too large for pipeline)",
        ],
        "recommended_next_actions": [
            "Register at https://urs.earthdata.nasa.gov/ and fill in .env",
            "Run python scripts/download_data.py (SRTM + MODIS will download after credentials)",
            "Confirm the three official challenge focus areas and update config/settings.json",
            "Review data/samples/ CSV files and share with Farwa and Harshil",
            "See docs/teammate_handoff.md for full handoff instructions",
        ],
    }

    with open(FINAL_REPORT_PATH, "w", encoding="utf-8") as fh:
        json.dump(final_report, fh, indent=2)

    logger.info("Pipeline complete in %.1f s – status: %s", elapsed_total, final_report["overall_status"])
    return final_report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the NASA Space Apps data pipeline")
    parser.add_argument("--stage", choices=["discover", "download", "clean", "samples", "validate"],
                        default=None, help="Run only this stage")
    parser.add_argument("--skip-large", action="store_true", help="Skip files > 100 MB")
    parser.add_argument("--dry-run", action="store_true", help="Discover + report without downloading")
    args = parser.parse_args()

    final = main(args)

    print("\n" + "=" * 70)
    print("FINAL PIPELINE REPORT")
    print("=" * 70)
    print(f"  Status       : {final['overall_status']}")
    print(f"  Total time   : {final['total_elapsed_s']} s")
    print(f"  Stages run   : {len(final['stages'])}")

    if final["ingestion_summary"].get("successful_datasets"):
        print(f"  Downloaded   : {final['ingestion_summary']['successful_datasets']}")
    if final["ingestion_summary"].get("skipped_auth"):
        print(f"  Need creds   : {final['ingestion_summary']['skipped_auth']}")

    print(f"\n  Files created ({len(final['files_created'])}):")
    for f in final["files_created"][:20]:
        print(f"    {f}")

    print(f"\n  Known limitations:")
    for lim in final["known_limitations"]:
        print(f"    ⚠ {lim}")

    print(f"\n  Next actions:")
    for act in final["recommended_next_actions"]:
        print(f"    → {act}")

    print("=" * 70)
    print(f"Full report: {FINAL_REPORT_PATH}")
    sys.exit(0 if final["overall_status"] == "PASS" else 1)
