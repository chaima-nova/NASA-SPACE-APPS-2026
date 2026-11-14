"""
src/validation/validators.py
Validation checks for files, configs, and processed datasets.
Each check returns a ValidationResult dict:
  { check, passed, detail, severity }
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)

Severity = str  # 'error' | 'warning' | 'info'


def _result(check: str, passed: bool, detail: str = "", severity: Severity = "error") -> dict:
    return {"check": check, "passed": passed, "detail": detail, "severity": severity}


# ---------------------------------------------------------------------------
# File system checks
# ---------------------------------------------------------------------------

def check_file_exists(path: Path, label: str = "") -> dict:
    path = Path(path)
    ok = path.exists()
    return _result(
        f"file_exists:{label or path.name}",
        ok,
        str(path) if ok else f"NOT FOUND: {path}",
    )


def check_file_nonempty(path: Path, label: str = "") -> dict:
    path = Path(path)
    if not path.exists():
        return _result(f"file_nonempty:{label or path.name}", False, f"File missing: {path}")
    size = path.stat().st_size
    ok = size > 0
    return _result(
        f"file_nonempty:{label or path.name}",
        ok,
        f"{size:,} bytes" if ok else f"Empty file: {path}",
        severity="warning" if not ok else "info",
    )


# ---------------------------------------------------------------------------
# Config checks
# ---------------------------------------------------------------------------

def validate_settings(settings_path: Path) -> List[dict]:
    """Validate config/settings.json structure."""
    results = []
    results.append(check_file_exists(settings_path, "settings.json"))
    if not settings_path.exists():
        return results
    try:
        with open(settings_path, encoding="utf-8") as fh:
            cfg = json.load(fh)
        results.append(_result("settings_json_valid", True, "JSON parsed OK", "info"))

        required_keys = ["pipeline", "focus_areas", "regions_of_interest", "download_limits"]
        for key in required_keys:
            ok = key in cfg
            results.append(_result(f"settings_has_{key}", ok, f"Key '{key}' present" if ok else f"MISSING key '{key}'"))

    except json.JSONDecodeError as exc:
        results.append(_result("settings_json_valid", False, str(exc)))

    return results


def validate_datasets_config(datasets_path: Path) -> List[dict]:
    """Validate config/datasets.json structure."""
    results = []
    results.append(check_file_exists(datasets_path, "datasets.json"))
    if not datasets_path.exists():
        return results
    try:
        with open(datasets_path, encoding="utf-8") as fh:
            cfg = json.load(fh)
        ok = isinstance(cfg.get("datasets"), list)
        results.append(_result("datasets_list_present", ok, f"{len(cfg.get('datasets', []))} datasets"))
        for ds in cfg.get("datasets", []):
            ds_id = ds.get("id", "unknown")
            for field in ["id", "name", "planetary_body", "enabled", "access_method"]:
                has_field = field in ds
                results.append(_result(
                    f"dataset_{ds_id}_has_{field}",
                    has_field,
                    f"Dataset '{ds_id}' missing field '{field}'" if not has_field else "",
                    severity="warning" if not has_field else "info",
                ))
    except json.JSONDecodeError as exc:
        results.append(_result("datasets_json_valid", False, str(exc)))
    return results


# ---------------------------------------------------------------------------
# DataFrame checks
# ---------------------------------------------------------------------------

def validate_dataframe(
    df: pd.DataFrame,
    required_columns: List[str],
    dataset_id: str,
    range_specs: Optional[Dict[str, tuple]] = None,
) -> List[dict]:
    """
    Validate a DataFrame:
    - Required columns present
    - DataFrame not empty
    - Value ranges (if provided)
    - No entirely-null columns
    """
    results = []

    results.append(_result(
        f"{dataset_id}_not_empty",
        len(df) > 0,
        f"{len(df)} rows",
        severity="error" if len(df) == 0 else "info",
    ))

    for col in required_columns:
        ok = col in df.columns
        results.append(_result(
            f"{dataset_id}_has_col_{col}",
            ok,
            f"Column '{col}' present" if ok else f"MISSING column '{col}'",
        ))

    for col in df.columns:
        if col == "qa_flag":
            continue
        all_null = df[col].isnull().all()
        results.append(_result(
            f"{dataset_id}_col_{col}_not_all_null",
            not all_null,
            f"Column '{col}' all-null!" if all_null else "",
            severity="warning",
        ))

    if range_specs:
        for col, (lo, hi) in range_specs.items():
            if col not in df.columns:
                continue
            out_pct = 100 * ((df[col] < lo) | (df[col] > hi)).sum() / max(len(df), 1)
            ok = out_pct < 5.0  # tolerate up to 5% out-of-range
            results.append(_result(
                f"{dataset_id}_{col}_range",
                ok,
                f"{out_pct:.1f}% out of [{lo}, {hi}]",
                severity="warning",
            ))

    return results


# ---------------------------------------------------------------------------
# Provenance check
# ---------------------------------------------------------------------------

def validate_provenance_record(record: dict, dataset_id: str) -> List[dict]:
    """Check that a download provenance record is complete."""
    results = []
    for field in ["url", "dest_path", "status", "timestamp"]:
        ok = field in record and record[field] is not None
        results.append(_result(
            f"{dataset_id}_provenance_{field}",
            ok,
            f"Missing provenance field '{field}'" if not ok else str(record[field])[:80],
            severity="warning",
        ))
    ok = record.get("status") == "success"
    results.append(_result(
        f"{dataset_id}_download_success",
        ok,
        record.get("status", "unknown"),
        severity="error" if not ok else "info",
    ))
    return results


# ---------------------------------------------------------------------------
# Report aggregator
# ---------------------------------------------------------------------------

def compile_report(all_results: List[dict], out_path: Optional[Path] = None) -> dict:
    """Aggregate validation results into a summary report."""
    errors = [r for r in all_results if not r["passed"] and r["severity"] == "error"]
    warnings = [r for r in all_results if not r["passed"] and r["severity"] == "warning"]
    passed = [r for r in all_results if r["passed"]]

    report = {
        "summary": {
            "total_checks": len(all_results),
            "passed": len(passed),
            "errors": len(errors),
            "warnings": len(warnings),
            "overall_pass": len(errors) == 0,
        },
        "errors": errors,
        "warnings": warnings,
        "passed": passed,
    }

    if out_path:
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=2)
        logger.info(
            "Validation report: %d checks, %d errors, %d warnings → %s",
            len(all_results), len(errors), len(warnings), out_path,
        )

    return report
