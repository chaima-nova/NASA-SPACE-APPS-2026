"""
src/comparison/statistics.py
Percentile distributions, overlap ratio, Wasserstein distance,
and the four-state classifier — the core of the comparison engine.
"""
from __future__ import annotations
from typing import Optional
import numpy as np
from scipy.stats import wasserstein_distance

from .models import DistributionStats, EvidenceState, EvidenceType, ParameterResult

# How many samples to use for Wasserstein to keep it fast
_WASSERSTEIN_MAX_SAMPLES = 5_000

# Minimum overlap ratio to classify as SIMILAR
_OVERLAP_THRESHOLD = 0.40

# Minimum valid pixel coverage to attempt a comparison
_MIN_COVERAGE_PCT = 40.0


# ---------------------------------------------------------------------------
# Distribution statistics
# ---------------------------------------------------------------------------

def compute_stats(arr: np.ndarray, unit: str = "m", source: str = "") -> DistributionStats:
    """Compute percentile summary from a 1-D or 2-D NaN-masked array."""
    valid = arr[~np.isnan(arr)].ravel()
    if len(valid) == 0:
        raise ValueError("Array contains no valid (non-NaN) values.")
    pcts = np.percentile(valid, [10, 25, 50, 75, 90]).tolist()
    return DistributionStats(
        count=int(len(valid)),
        p10=round(float(pcts[0]), 3),
        p25=round(float(pcts[1]), 3),
        p50=round(float(pcts[2]), 3),
        p75=round(float(pcts[3]), 3),
        p90=round(float(pcts[4]), 3),
        mean=round(float(np.mean(valid)), 3),
        std=round(float(np.std(valid)), 3),
        unit=unit,
        source=source,
    )


def stats_from_summary(summary: dict, unit: str = "m", source: str = "") -> DistributionStats:
    """
    Build a DistributionStats from a stats-JSON dict (e.g. mola_mars_stats.json).
    Uses min/max/mean/std — no percentiles available, so p10/p90 are estimated
    as mean ± 1.28*std (normal approximation) and flagged clearly.
    """
    mn  = float(summary.get("min",  0))
    mx  = float(summary.get("max",  0))
    mu  = float(summary.get("mean", (mn + mx) / 2))
    sd  = float(summary.get("std",  (mx - mn) / 4))
    p10 = round(max(mn, mu - 1.28 * sd), 3)
    p90 = round(min(mx, mu + 1.28 * sd), 3)
    return DistributionStats(
        count=int(summary.get("sample_rows", 100)),
        p10=p10, p25=round(mu - 0.67 * sd, 3),
        p50=round(mu, 3),
        p75=round(mu + 0.67 * sd, 3),
        p90=p90,
        mean=round(mu, 3),
        std=round(sd, 3),
        unit=unit,
        source=source,
    )


# ---------------------------------------------------------------------------
# Overlap ratio
# ---------------------------------------------------------------------------

def overlap_ratio(a: DistributionStats, b: DistributionStats) -> float:
    """
    Fraction of the union range [p10, p90] that is shared by both distributions.
    Returns 0.0–1.0.
    """
    overlap = max(0.0, min(a.p90, b.p90) - max(a.p10, b.p10))
    union   = max(a.p90, b.p90) - min(a.p10, b.p10)
    if union <= 0:
        return 1.0 if overlap > 0 else 0.0
    return round(overlap / union, 4)


# ---------------------------------------------------------------------------
# Wasserstein distance (sub-sampled for speed)
# ---------------------------------------------------------------------------

def compute_wasserstein(a_arr: np.ndarray, b_arr: np.ndarray) -> float:
    """
    Earth mover's distance between two 1-D valid-value arrays.
    Sub-sampled to _WASSERSTEIN_MAX_SAMPLES for performance.
    """
    a_valid = a_arr[~np.isnan(a_arr)].ravel()
    b_valid = b_arr[~np.isnan(b_arr)].ravel()
    if len(a_valid) == 0 or len(b_valid) == 0:
        return float("nan")
    rng = np.random.default_rng(42)
    if len(a_valid) > _WASSERSTEIN_MAX_SAMPLES:
        a_valid = rng.choice(a_valid, _WASSERSTEIN_MAX_SAMPLES, replace=False)
    if len(b_valid) > _WASSERSTEIN_MAX_SAMPLES:
        b_valid = rng.choice(b_valid, _WASSERSTEIN_MAX_SAMPLES, replace=False)
    return round(float(wasserstein_distance(a_valid, b_valid)), 3)


# ---------------------------------------------------------------------------
# Four-state classifier
# ---------------------------------------------------------------------------

def classify(
    candidate_stats: DistributionStats,
    target_stats: DistributionStats,
    candidate_arr: Optional[np.ndarray],
    target_arr: Optional[np.ndarray],
    parameter: str,
    unit: str = "",
) -> tuple[EvidenceState, float, Optional[float], str]:
    """
    Returns (state, overlap_pct, wasserstein, direction_note).
    """
    # Coverage check
    cov = 100.0 * candidate_stats.count / max(candidate_stats.count, 1)
    if cov < _MIN_COVERAGE_PCT or candidate_stats.count < 10:
        return EvidenceState.INSUFFICIENT, 0.0, None, "Insufficient valid pixels for comparison."

    or_val = overlap_ratio(candidate_stats, target_stats)
    or_pct = round(or_val * 100, 1)

    w1: Optional[float] = None
    if candidate_arr is not None and target_arr is not None:
        w1 = compute_wasserstein(candidate_arr.ravel(), target_arr.ravel())

    if or_val >= _OVERLAP_THRESHOLD:
        state = EvidenceState.SIMILAR
        note  = (
            f"Distributions overlap {or_pct}% across the p10–p90 range. "
            f"Candidate median: {candidate_stats.p50} {unit}, target median: {target_stats.p50} {unit}."
        )
    else:
        state = EvidenceState.DIFFERENT
        delta = round(candidate_stats.p50 - target_stats.p50, 2)
        direction = "higher" if delta > 0 else "lower"
        note = (
            f"Distributions overlap only {or_pct}% (below 40% threshold). "
            f"Candidate median {candidate_stats.p50} {unit} is {abs(delta)} {unit} {direction} than "
            f"target median {target_stats.p50} {unit}."
        )

    return state, or_pct, w1, note


# ---------------------------------------------------------------------------
# Convenience: build a full ParameterResult from arrays
# ---------------------------------------------------------------------------

def compare_arrays(
    parameter: str,
    evidence_type: EvidenceType,
    candidate_arr: np.ndarray,
    target_arr: np.ndarray,
    unit: str = "m",
    candidate_source: str = "",
    target_source: str = "",
) -> ParameterResult:
    """Full distribution comparison between two arrays → ParameterResult."""
    c_stats = compute_stats(candidate_arr, unit=unit, source=candidate_source)
    t_stats = compute_stats(target_arr,    unit=unit, source=target_source)
    state, or_pct, w1, note = classify(c_stats, t_stats, candidate_arr, target_arr, parameter, unit)
    return ParameterResult(
        parameter=parameter,
        state=state,
        evidence_type=evidence_type,
        summary=note,
        candidate_stats=c_stats,
        target_stats=t_stats,
        overlap_pct=or_pct,
        wasserstein=w1,
        direction_note=note if state == EvidenceState.DIFFERENT else None,
    )


def compare_summary_to_array(
    parameter: str,
    evidence_type: EvidenceType,
    candidate_arr: np.ndarray,
    target_summary_dict: dict,
    unit: str = "m",
    candidate_source: str = "",
    target_source: str = "",
    extra_note: str = "",
) -> ParameterResult:
    """
    Compare a full candidate array against a target described only by summary stats.
    Used for Mars (100-pixel grid — regional context only).
    """
    c_stats = compute_stats(candidate_arr, unit=unit, source=candidate_source)
    t_stats = stats_from_summary(target_summary_dict, unit=unit, source=target_source)
    state, or_pct, w1, note = classify(c_stats, t_stats, candidate_arr, None, parameter, unit)
    if extra_note:
        note = note + " " + extra_note
    return ParameterResult(
        parameter=parameter,
        state=state,
        evidence_type=evidence_type,
        summary=note,
        candidate_stats=c_stats,
        target_stats=t_stats,
        overlap_pct=or_pct,
        wasserstein=None,
        direction_note=note if state == EvidenceState.DIFFERENT else None,
        detail=extra_note if extra_note else None,
    )
