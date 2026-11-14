"""
scripts/validate_data.py
──────────────────────────────────────────────────────────────────────────────
Stage 5: Run all validation checks and produce validation_report.json.

Usage:
  python scripts/validate_data.py
"""
from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.validation.validators import (
    check_file_exists,
    check_file_nonempty,
    compile_report,
    validate_datasets_config,
    validate_settings,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(ROOT / "reports" / "pipeline.log", mode="a"),
    ],
)
logger = logging.getLogger("validate_data")


def run_all_checks() -> list[dict]:
    all_results = []

    # ── Config validation ─────────────────────────────────────────────────
    logger.info("Validating config files...")
    all_results += validate_settings(ROOT / "config" / "settings.json")
    all_results += validate_datasets_config(ROOT / "config" / "datasets.json")

    # ── Required project files ────────────────────────────────────────────
    required_files = [
        ROOT / "requirements.txt",
        ROOT / ".gitignore",
        ROOT / ".env.example",
        ROOT / "config" / "datasets.json",
        ROOT / "config" / "settings.json",
    ]
    for f in required_files:
        all_results.append(check_file_exists(f))
        all_results.append(check_file_nonempty(f))

    # ── Script files ──────────────────────────────────────────────────────
    scripts = [
        "scripts/discover_datasets.py",
        "scripts/download_data.py",
        "scripts/inspect_data.py",
        "scripts/clean_data.py",
        "scripts/build_samples.py",
        "scripts/run_pipeline.py",
        "scripts/validate_data.py",
    ]
    for s in scripts:
        path = ROOT / s
        all_results.append(check_file_exists(path, s))

    # ── Source modules ────────────────────────────────────────────────────
    src_modules = [
        "src/ingestion/base.py",
        "src/ingestion/earthdata.py",
        "src/ingestion/pds.py",
        "src/ingestion/nasa_api.py",
        "src/processing/pds_reader.py",
        "src/processing/terrain.py",
        "src/processing/cleaner.py",
        "src/processing/sample_builder.py",
        "src/validation/validators.py",
        "src/provenance/tracker.py",
    ]
    for m in src_modules:
        path = ROOT / m
        all_results.append(check_file_exists(path, m))
        all_results.append(check_file_nonempty(path, m))

    # ── Docs ──────────────────────────────────────────────────────────────
    docs = [
        "docs/dataset_catalog.csv",
        "docs/data_sources.md",
        "docs/data_dictionary.md",
        "docs/pipeline_architecture.md",
        "docs/known_limitations.md",
        "docs/teammate_handoff.md",
    ]
    for d in docs:
        path = ROOT / d
        all_results.append(check_file_exists(path, d))

    # ── Raw data (if present) ─────────────────────────────────────────────
    lola_img = ROOT / "data" / "raw" / "moon" / "lola_64ppd" / "ldem_64.img"
    lola_lbl = ROOT / "data" / "raw" / "moon" / "lola_64ppd" / "ldem_64.lbl"
    mola_img = ROOT / "data" / "raw" / "mars" / "mola_meg128" / "megt90n000cb.img"

    for f in [lola_img, lola_lbl, mola_img]:
        r = check_file_exists(f)
        r["severity"] = "warning"  # downgrade to warning (optional data)
        all_results.append(r)
        if f.exists():
            all_results.append(check_file_nonempty(f))

    # ── Sample data (must exist after build_samples) ──────────────────────
    sample_dir = ROOT / "data" / "samples"
    for csv in sample_dir.glob("*.csv"):
        all_results.append(check_file_nonempty(csv, csv.name))

    return all_results


if __name__ == "__main__":
    logger.info("Running validation checks...")
    results = run_all_checks()

    out_path = ROOT / "reports" / "validation_report.json"
    report = compile_report(results, out_path)

    print("\n" + "=" * 60)
    print("VALIDATION REPORT")
    print("=" * 60)
    print(f"  Total checks : {report['summary']['total_checks']}")
    print(f"  Passed       : {report['summary']['passed']}")
    print(f"  Errors       : {report['summary']['errors']}")
    print(f"  Warnings     : {report['summary']['warnings']}")
    print(f"  Overall PASS : {report['summary']['overall_pass']}")

    if report["errors"]:
        print("\nERRORS:")
        for e in report["errors"]:
            print(f"  ✗ {e['check']}: {e['detail']}")

    if report["warnings"]:
        print("\nWARNINGS:")
        for w in report["warnings"]:
            print(f"  ⚠ {w['check']}: {w['detail']}")

    print("=" * 60)
    print(f"Saved: {out_path}")

    sys.exit(0 if report["summary"]["overall_pass"] else 1)
