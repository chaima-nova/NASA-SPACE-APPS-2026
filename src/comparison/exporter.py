"""
src/comparison/exporter.py
Serialise a ComparisonReport to JSON and write to reports/.
"""
from __future__ import annotations
import dataclasses
import json
import os
from enum import Enum
from pathlib import Path

from .models import ComparisonReport


# ---------------------------------------------------------------------------
# Custom JSON encoder — handles Enums and dataclasses
# ---------------------------------------------------------------------------

class _TerranexusEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Enum):
            return obj.value
        if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
            return dataclasses.asdict(obj)
        return super().default(obj)


def _serialise(report: ComparisonReport) -> dict:
    """
    Convert a ComparisonReport into a plain dict suitable for JSON output.
    Enums are converted to their string values.
    DimensionResult objects are expanded into the {similarities, mismatches, evidence} shape.
    """
    raw = dataclasses.asdict(report)

    # Recursively convert Enum values (asdict leaves them as Enum instances
    # inside nested dicts when the dataclass contains Enum-typed fields that
    # are themselves NOT wrapped in another dataclass — safety pass).
    def _fix(obj):
        if isinstance(obj, dict):
            return {k: _fix(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_fix(v) for v in obj]
        if isinstance(obj, Enum):
            return obj.value
        return obj

    return _fix(raw)


# ---------------------------------------------------------------------------
# Public export function
# ---------------------------------------------------------------------------

def export_report(
    report: ComparisonReport,
    output_dir: str | os.PathLike = "reports",
    filename: str | None = None,
) -> Path:
    """
    Serialise *report* to JSON and write it to *output_dir*.

    Parameters
    ----------
    report      : ComparisonReport
    output_dir  : directory (created if absent); default "reports"
    filename    : override default name; default
                  ``comparison_results_<candidate>_vs_<target>.json``

    Returns
    -------
    Path of the written file.
    """
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if filename is None:
        target_body = report.planetary_context.get("target_body", "unknown")
        filename = f"comparison_results_{report.candidate_id}_vs_{target_body}.json"

    out_path = out_dir / filename

    payload = _serialise(report)

    # --- top-level shape matches Jaz's expected schema ---
    # Re-map dimensions: DimensionResult → {similarities, mismatches, evidence}
    dims_out: dict = {}
    for dim_name, dim_data in payload["dimensions"].items():
        dims_out[dim_name] = {
            "status":       dim_data.get("status", ""),
            "similarities": _flatten_param_list(dim_data.get("similarities", [])),
            "mismatches":   _flatten_param_list(dim_data.get("mismatches", [])),
            "evidence":     _flatten_param_list(dim_data.get("evidence", [])),
        }

    output_doc = {
        "candidate_id":      payload["candidate_id"],
        "engine_version":    payload["engine_version"],
        "framework":         payload["framework"],
        "location":          payload["location"],
        "planetary_context": payload["planetary_context"],
        "dimensions":        dims_out,
        "data_quality":      payload["data_quality"],
        "uncertainties":     payload["uncertainties"],
        "limitations":       payload["limitations"],
    }

    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(output_doc, fh, indent=2, cls=_TerranexusEncoder, ensure_ascii=False)

    return out_path


# ---------------------------------------------------------------------------
# Helper: strip None fields from ParameterResult dicts for clean output
# ---------------------------------------------------------------------------

def _flatten_param_list(params: list[dict]) -> list[dict]:
    """Remove None-valued keys from each ParameterResult dict."""
    cleaned = []
    for p in params:
        cleaned.append({k: v for k, v in p.items() if v is not None})
    return cleaned
