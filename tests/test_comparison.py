"""
tests/test_comparison.py
Pytest suite for the TERRANEXUS Comparison Engine.
Run with:
    pytest tests/test_comparison.py -v

8 tests, all must pass for hackathon demo.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

import numpy as np
import pytest

# --- ensure project root is importable ---
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.comparison.models import (
    EvidenceState,
    EvidenceType,
    ParameterResult,
)
from src.comparison.statistics import overlap_ratio, classify, compute_stats
from src.comparison.thermal_evaluator import evaluate_thermal
from src.comparison.geology_crosswalk import evaluate_geological_units
from src.comparison.engine import ComparisonEngine
from src.comparison.loader import load_earth_atacama, load_moon_south_pole, load_mars_jezero
from src.comparison.exporter import export_report


# ===========================================================================
# Test 1 — Datum guard: absolute_elevation is always NOT_COMPARABLE
# ===========================================================================

def test_datum_guard():
    """absolute_elevation ParameterResult must always be NOT_COMPARABLE."""
    earth = load_earth_atacama()
    moon  = load_moon_south_pole()
    report = ComparisonEngine.compare(earth, moon)

    terrain = report.dimensions["terrain_topography"]
    all_params = terrain.similarities + terrain.mismatches + terrain.evidence
    datum_results = [p for p in all_params if p.parameter == "absolute_elevation"]

    assert len(datum_results) == 1, "absolute_elevation must appear exactly once"
    assert datum_results[0].state == EvidenceState.NOT_COMPARABLE, (
        f"Expected NOT_COMPARABLE, got {datum_results[0].state}"
    )


# ===========================================================================
# Test 2 — Overlap ratio: identical arrays → OR = 1.0, state SIMILAR
# ===========================================================================

def test_overlap_ratio_identical():
    """Identical arrays must yield OR = 1.0 and SIMILAR state."""
    arr = np.random.default_rng(42).uniform(0, 10, 500).astype(np.float32)
    stats = compute_stats(arr)
    or_val = overlap_ratio(stats, stats)
    assert abs(or_val - 1.0) < 1e-6, f"Expected OR=1.0, got {or_val}"

    state, or_pct, w1, note = classify(stats, stats, arr, arr, "elevation", "m")
    assert state == EvidenceState.SIMILAR


# ===========================================================================
# Test 3 — Overlap ratio: disjoint arrays → OR = 0.0, state DIFFERENT
# ===========================================================================

def test_overlap_ratio_disjoint():
    """Non-overlapping ranges must yield OR = 0.0 and DIFFERENT state."""
    low  = np.arange(0.0, 50.0, dtype=np.float32)
    high = np.arange(100.0, 150.0, dtype=np.float32)
    stats_low  = compute_stats(low)
    stats_high = compute_stats(high)
    or_val = overlap_ratio(stats_low, stats_high)
    assert or_val < 1e-6, f"Expected OR=0.0, got {or_val}"

    state, or_pct, w1, note = classify(stats_low, stats_high, low, high, "elevation", "m")
    assert state == EvidenceState.DIFFERENT


# ===========================================================================
# Test 4 — Thermal: surface_temp, amplitude, thermal_inertia → INSUFFICIENT
# ===========================================================================

@pytest.mark.parametrize("body", ["moon", "mars"])
def test_thermal_all_insufficient(body):
    """
    For both moon and mars, surface_temperature, day_night_thermal_amplitude,
    and thermal_inertia must be INSUFFICIENT_EVIDENCE.
    """
    results = evaluate_thermal(body)
    insufficient_params = {
        "surface_temperature",
        "day_night_thermal_amplitude",
        "thermal_inertia",
    }
    insufficient_found = {
        r.parameter for r in results
        if r.state == EvidenceState.INSUFFICIENT
    }
    missing = insufficient_params - insufficient_found
    assert not missing, (
        f"Expected INSUFFICIENT_EVIDENCE for {missing} on body='{body}'"
    )


# ===========================================================================
# Test 5 — End-to-end: Earth vs Moon produces valid ComparisonReport
# ===========================================================================

def test_end_to_end_moon():
    """ComparisonEngine.compare(earth, moon) must run without error
    and return all 3 dimension keys."""
    earth = load_earth_atacama()
    moon  = load_moon_south_pole()
    report = ComparisonEngine.compare(earth, moon)

    assert report.candidate_id is not None
    for dim in ("terrain_topography", "surface_geology", "temperature_thermal"):
        assert dim in report.dimensions, f"Missing dimension: {dim}"
    assert len(report.limitations) >= 4, "Must document at least 4 physical limitations"


# ===========================================================================
# Test 6 — End-to-end: Earth vs Mars uses summary-stats path
# ===========================================================================

def test_end_to_end_mars():
    """ComparisonEngine.compare(earth, mars) must succeed.
    Mars 10×10 = 100 px so use_summary_for_target path is exercised."""
    earth = load_earth_atacama()
    mars  = load_mars_jezero()

    # Confirm Mars trips the summary threshold
    assert mars.n_valid_elevation <= 150, (
        f"Test assumption violated: Mars has {mars.n_valid_elevation} valid px (expected ≤150)"
    )

    report = ComparisonEngine.compare(earth, mars)

    for dim in ("terrain_topography", "surface_geology", "temperature_thermal"):
        assert dim in report.dimensions, f"Missing dimension: {dim}"

    assert report.planetary_context["target_body"] == "mars"


# ===========================================================================
# Test 7 — Geology crosswalk: Atacama vs Moon has ≥1 SIMILAR unit
# ===========================================================================

def test_geology_crosswalk_match():
    """
    Geological crosswalk:
    - Earth Atacama vs Mars Jezero shares 'plains_and_lowlands' -> SIMILAR
    - Earth Atacama vs Moon South Pole has no shared classes -> DIFFERENT
    """
    earth = load_earth_atacama()
    moon  = load_moon_south_pole()
    mars  = load_mars_jezero()

    results_mars = evaluate_geological_units(
        candidate_id=earth.region_id,
        target_id=mars.region_id,
    )
    similar_mars = [r for r in results_mars if r.state == EvidenceState.SIMILAR]
    assert len(similar_mars) >= 1, "Expected >= 1 SIMILAR geological unit for Atacama vs Mars"
    assert "plains_and_lowlands" in similar_mars[0].summary

    results_moon = evaluate_geological_units(
        candidate_id=earth.region_id,
        target_id=moon.region_id,
    )
    geo_moon = [r for r in results_moon if r.parameter == "geological_units"]
    assert len(geo_moon) == 1
    assert geo_moon[0].state == EvidenceState.DIFFERENT


# ===========================================================================
# Test 8 — JSON schema: exported file has all required top-level keys
# ===========================================================================

def test_json_schema_validity(tmp_path):
    """
    Exported JSON must contain all keys required by Jaz's frontend schema.
    """
    earth = load_earth_atacama()
    moon  = load_moon_south_pole()
    report = ComparisonEngine.compare(earth, moon)

    out_path = export_report(report, output_dir=tmp_path)
    assert out_path.exists(), "export_report did not create a file"

    with open(out_path, encoding="utf-8") as fh:
        doc = json.load(fh)

    required_top = ["candidate_id", "location", "planetary_context",
                    "dimensions", "data_quality", "uncertainties", "limitations"]
    for key in required_top:
        assert key in doc, f"Missing top-level key: '{key}'"

    required_dims = ["terrain_topography", "surface_geology", "temperature_thermal"]
    for dim in required_dims:
        assert dim in doc["dimensions"], f"Missing dimension: '{dim}'"
        dim_data = doc["dimensions"][dim]
        for sub in ("similarities", "mismatches", "evidence"):
            assert sub in dim_data, f"Dimension '{dim}' missing '{sub}' key"
            assert isinstance(dim_data[sub], list), f"'{dim}.{sub}' must be a list"

    loc = doc["location"]
    assert "name" in loc and "coordinates" in loc, "location missing name or coordinates"

    dq = doc["data_quality"]
    for dq_key in ("candidate_resolution_m", "target_resolution_m", "common_baseline_applied"):
        assert dq_key in dq, f"data_quality missing '{dq_key}'"

    assert len(doc["uncertainties"]) >= 1, "uncertainties list is empty"
    assert len(doc["limitations"])  >= 1, "limitations list is empty"
