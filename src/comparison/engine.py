"""
src/comparison/engine.py
Master orchestrator for the TERRANEXUS Comparison Engine.
Coordinates terrain, geology, and thermal dimensions → ComparisonReport.
"""
from __future__ import annotations
import numpy as np

from .loader import PlanetaryDataset, load_earth_atacama, load_moon_south_pole, load_mars_jezero
from .models import (
    ComparisonReport, DataQuality, DimensionResult,
    EvidenceState, EvidenceType, ParameterResult, PhysicalLimitation,
)
from .terrain_metrics import compute_windowed_relief, flat_valid
from .statistics import compare_arrays, compare_summary_to_array, compute_stats
from .geology_crosswalk import evaluate_geological_units
from .thermal_evaluator import evaluate_thermal


# ---------------------------------------------------------------------------
# Physical limitations (always appended — same for all comparisons)
# ---------------------------------------------------------------------------

def _physical_limitations(target_body: str) -> list[PhysicalLimitation]:
    if target_body == "moon":
        g_target = "0.166 g (1.62 m/s²)"
        atm_target = "~10⁻¹² hPa (hard vacuum)"
        rad_target = "Direct GCR and solar particle events (no magnetospheric shielding)"
        wx_target  = "Micrometeorite comminution only; no atmospheric weathering; glassy electrostatic agglutinates"
    else:
        g_target = "0.38 g (3.72 m/s²)"
        atm_target = "~6 hPa CO₂ (< 1% of Earth)"
        rad_target = "Elevated UV and cosmic-ray flux; thin CO₂ atmosphere offers minimal shielding"
        wx_target  = "Aeolian dust transport; toxic perchlorate (ClO₄⁻) chemistry; no liquid water"

    return [
        PhysicalLimitation("gravity",          "1.00 g (9.81 m/s²)", g_target,
            "Slope stability, avalanche dynamics, and rover traction differ fundamentally. "
            "Equal slope angles are NOT equally hazardous across bodies."),
        PhysicalLimitation("atmospheric_pressure", "1,013.25 hPa (N₂/O₂)", atm_target,
            "No convective heat dissipation, no liquid water stability, no atmospheric pressure on suits or habitats."),
        PhysicalLimitation("ionizing_radiation", "Geomagnetically shielded", rad_target,
            "Surface habitats require regolith berming or sub-surface siting. No Earth analogue preparation addresses this."),
        PhysicalLimitation("biological_and_chemical_weathering",
            "Active microbial, hydro-chemical, and aeolian weathering",
            wx_target,
            "Earth regolith contains organic binders. Target body regolith is mechanically abrasive or chemically hazardous."),
    ]


# ---------------------------------------------------------------------------
# Terrain dimension
# ---------------------------------------------------------------------------

def _evaluate_terrain(
    candidate: PlanetaryDataset,
    target: PlanetaryDataset,
    use_summary_for_target: bool = False,
) -> DimensionResult:
    """Build terrain_topography DimensionResult."""

    similarities: list[ParameterResult] = []
    mismatches:   list[ParameterResult] = []
    evidence:     list[ParameterResult] = []

    # --- Absolute elevation: always NOT_COMPARABLE ---
    datum_map = {
        "earth": "EGM96 geoid (mean sea level = 0 m)",
        "moon":  "Geometric sphere R = 1,737,400 m (not a gravity equipotential surface)",
        "mars":  "Gravitational areoid — equipotential surface at ~6.1 mbar pressure level",
    }
    evidence.append(ParameterResult(
        parameter="absolute_elevation",
        state=EvidenceState.NOT_COMPARABLE,
        evidence_type=EvidenceType.DATUM_INCOMPATIBILITY,
        summary="Absolute elevations cannot be compared across planetary bodies.",
        detail=(
            f"Candidate datum: {datum_map.get(candidate.body, candidate.body)}. "
            f"Target datum: {datum_map.get(target.body, target.body)}. "
            "MOLA total vertical uncertainty ≥ 3 m; LOLA ≤ 1 m."
        ),
    ))

    # --- Local relief ---
    cand_relief = compute_windowed_relief(candidate.elevation, window_px=3)
    cand_relief_valid = flat_valid(cand_relief)

    if use_summary_for_target:
        # Mars: target relief estimated from elevation range in stats JSON
        targ_stats_dict = target.stats.get("elevation_m", {})
        targ_relief_approx = targ_stats_dict.get("max", 0) - targ_stats_dict.get("min", 0)
        # Build a crude synthetic summary for relief
        targ_relief_summary = {
            "min": 0.0,
            "max": targ_relief_approx,
            "mean": targ_relief_approx * 0.4,
            "std":  targ_relief_approx * 0.25,
            "sample_rows": target.n_valid_elevation,
        }
        relief_result = compare_summary_to_array(
            parameter="local_relief",
            evidence_type=EvidenceType.DIRECT_MEASUREMENT,
            candidate_arr=cand_relief_valid,
            target_summary_dict=targ_relief_summary,
            unit="m",
            candidate_source=f"Windowed Δh (3×3 px window, {candidate.resolution_m:.0f} m/px)",
            target_source=f"Estimated from elevation range in {target.stats.get('dataset_id','').upper()} stats JSON (regional context only)",
            extra_note=(
                f"Target grid is {target.shape[0]}×{target.shape[1]} = {target.n_valid_elevation} pixels "
                f"at {target.resolution_m/1000:.1f} km/px — regional landscape context, not fine-scale terrain."
            ),
        )
    else:
        targ_relief = compute_windowed_relief(target.elevation, window_px=3)
        relief_result = compare_arrays(
            parameter="local_relief",
            evidence_type=EvidenceType.DIRECT_MEASUREMENT,
            candidate_arr=flat_valid(cand_relief),
            target_arr=flat_valid(targ_relief),
            unit="m",
            candidate_source=f"Windowed Δh (3×3 px, {candidate.resolution_m:.0f} m/px)",
            target_source=f"Windowed Δh (3×3 px, {target.resolution_m:.0f} m/px)",
        )

    (similarities if relief_result.state == EvidenceState.SIMILAR else mismatches).append(relief_result)

    # --- Slope ---
    if use_summary_for_target:
        slope_result = compare_summary_to_array(
            parameter="slope_deg",
            evidence_type=EvidenceType.MODEL_DERIVED,
            candidate_arr=flat_valid(candidate.slope),
            target_summary_dict=target.stats.get("slope_deg", {}),
            unit="°",
            candidate_source=f"Pre-computed by terrain.py at {candidate.resolution_m:.0f} m/px",
            target_source=f"Pre-computed by terrain.py at {target.resolution_m/1000:.1f} km/px (regional context)",
            extra_note=(
                "Resolution disparity: candidate slope reflects sub-km terrain at 180 m/px; "
                f"target slope averages {target.resolution_m/1000:.1f}-km landscape tiles. "
                "Comparison is indicative only."
            ),
        )
    else:
        slope_result = compare_arrays(
            parameter="slope_deg",
            evidence_type=EvidenceType.MODEL_DERIVED,
            candidate_arr=flat_valid(candidate.slope),
            target_arr=flat_valid(target.slope),
            unit="°",
            candidate_source=f"Pre-computed by terrain.py at {candidate.resolution_m:.0f} m/px",
            target_source=f"Pre-computed by terrain.py at {target.resolution_m/1000:.1f} km/px",
        )

    (similarities if slope_result.state == EvidenceState.SIMILAR else mismatches).append(slope_result)

    # --- Roughness — always DIFFERENT with resolution explanation ---
    c_rough_stats = compute_stats(flat_valid(candidate.roughness), unit="m",
                                  source=f"TRI pre-computed at {candidate.resolution_m:.0f} m/px")
    if use_summary_for_target:
        t_rough_mean = target.stats.get("roughness_tri_m", {}).get("mean", float("nan"))
        t_rough_note = f"Target TRI mean {t_rough_mean:.0f} m at {target.resolution_m/1000:.1f} km/px"
    else:
        t_rough_stats = compute_stats(flat_valid(target.roughness), unit="m",
                                      source=f"TRI pre-computed at {target.resolution_m/1000:.1f} km/px")
        t_rough_note  = f"Target TRI median {t_rough_stats.p50:.0f} m"

    mismatches.append(ParameterResult(
        parameter="surface_roughness_tri",
        state=EvidenceState.DIFFERENT,
        evidence_type=EvidenceType.MODEL_DERIVED,
        summary=(
            f"TRI roughness cannot be validly compared across resolution scales. "
            f"Candidate TRI median {c_rough_stats.p50:.1f} m at {candidate.resolution_m:.0f} m/px; "
            f"{t_rough_note}. "
            "Difference reflects pixel footprint, not terrain truth. "
            "Common-baseline resampling required for a valid comparison."
        ),
        candidate_stats=c_rough_stats,
        detail="Resolution-scale artefact — not a scientific terrain mismatch.",
    ))

    # Dimension status
    n_sim = len(similarities)
    n_mis = len(mismatches)
    if n_sim > 0 and n_mis > 0:
        status = "MIXED"
    elif n_sim > 0:
        status = "SIMILAR"
    else:
        status = "DIFFERENT"

    return DimensionResult(
        dimension="terrain_topography",
        status=status,
        similarities=similarities,
        mismatches=mismatches,
        evidence=evidence,
    )


# ---------------------------------------------------------------------------
# Geology dimension
# ---------------------------------------------------------------------------

def _evaluate_geology(candidate: PlanetaryDataset, target: PlanetaryDataset) -> DimensionResult:
    results = evaluate_geological_units(candidate.region_id, target.region_id)

    geo_units   = results[0]
    surf_mat    = results[1]
    mineral     = results[2]

    similarities = [geo_units] if geo_units.state == EvidenceState.SIMILAR else []
    mismatches   = [geo_units] if geo_units.state == EvidenceState.DIFFERENT else []
    evidence     = [surf_mat, mineral]

    # Weathering mismatch (always present — Earth has weathering, neither Moon nor Mars do)
    mismatches.append(ParameterResult(
        parameter="weathering_state",
        state=EvidenceState.DIFFERENT,
        evidence_type=EvidenceType.CLASSIFICATION_BASED,
        summary=(
            "Earth Atacama shows aeolian deflation and trace evaporite alteration (gypsum, halite). "
            "Target surface has no atmospheric weathering — only micrometeorite comminution (Moon) "
            "or aeolian perchlorate chemistry (Mars). Earth soil is weathered; target regolith is pristine or reactive."
        ),
    ))

    n_sim = len(similarities)
    n_mis = len(mismatches)
    status = "QUALITATIVE_MATCH" if n_sim > 0 else ("DIFFERENT" if n_mis > 0 else "INSUFFICIENT")

    return DimensionResult(
        dimension="surface_geology",
        status=status,
        similarities=similarities,
        mismatches=mismatches,
        evidence=evidence,
    )


# ---------------------------------------------------------------------------
# Thermal dimension
# ---------------------------------------------------------------------------

def _evaluate_thermal(target: PlanetaryDataset) -> DimensionResult:
    results = evaluate_thermal(target.body)

    insufficient = [r for r in results if r.state == EvidenceState.INSUFFICIENT]
    not_comparable = [r for r in results if r.state == EvidenceState.NOT_COMPARABLE]

    return DimensionResult(
        dimension="temperature_thermal",
        status="INSUFFICIENT_EVIDENCE",
        similarities=[],
        mismatches=not_comparable,
        evidence=insufficient,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class ComparisonEngine:

    @staticmethod
    def compare(candidate: PlanetaryDataset, target: PlanetaryDataset) -> ComparisonReport:
        """Run all three dimensions and return a ComparisonReport."""

        use_summary = target.n_valid_elevation <= 150   # Mars 10×10 = 100

        terrain = _evaluate_terrain(candidate, target, use_summary_for_target=use_summary)
        geology = _evaluate_geology(candidate, target)
        thermal = _evaluate_thermal(target)

        # Data quality block
        c_valid_pct = round(100.0 * np.sum(~np.isnan(candidate.elevation)) / candidate.elevation.size, 1)
        t_valid_pct = round(100.0 * np.sum(~np.isnan(target.elevation))   / target.elevation.size,    1)

        dq = DataQuality(
            candidate_source=candidate.stats.get("source_citation", candidate.region_id),
            candidate_resolution_m=candidate.resolution_m,
            candidate_grid_shape=list(candidate.shape),
            candidate_valid_pct=c_valid_pct,
            target_source=target.stats.get("source_citation", target.region_id),
            target_resolution_m=target.resolution_m,
            target_grid_shape=list(target.shape),
            target_valid_pct=t_valid_pct,
        )

        uncertainties = [
            (
                f"Resolution disparity is the dominant uncertainty: candidate at {candidate.resolution_m:.0f} m/px "
                f"captures sub-km terrain; target at {target.resolution_m/1000:.1f} km/px averages landscape-scale features."
            ),
        ]
        if use_summary:
            uncertainties.append(
                f"Target grid ({target.shape[0]}×{target.shape[1]} = {target.n_valid_elevation} pixels) "
                f"is too coarse for distribution comparison. Summary statistics used as reference bounds."
            )
        uncertainties.append(
            "All thermal and mineralogical parameters are INSUFFICIENT_EVIDENCE — pending dataset ingestion."
        )
        uncertainties.append(
            "Geological crosswalk is a draft built from map group names only. "
            "Full unit descriptions have not been verified."
        )

        return ComparisonReport(
            candidate_id=candidate.region_id,
            location={
                "name": candidate.stats.get("region", candidate.region_id),
                "coordinates": [
                    round((candidate.stats.get("bbox", [0, 0, 0, 0])[1] +
                           candidate.stats.get("bbox", [0, 0, 0, 0])[3]) / 2, 3),
                    round((candidate.stats.get("bbox", [0, 0, 0, 0])[0] +
                           candidate.stats.get("bbox", [0, 0, 0, 0])[2]) / 2, 3),
                ],
                "bbox": candidate.stats.get("bbox", []),
                "analyzed_region": candidate.stats.get("region", ""),
                "source_dataset": candidate.stats.get("dataset_id", ""),
                "native_resolution_m": candidate.resolution_m,
            },
            planetary_context={
                "target_body": target.body,
                "target_region": target.stats.get("region", target.region_id),
                "target_bbox": target.stats.get("bbox", []),
                "target_source_dataset": target.stats.get("dataset_id", ""),
                "target_native_resolution_m": target.resolution_m,
                "target_grid_shape": list(target.shape),
            },
            dimensions={
                "terrain_topography": terrain,
                "surface_geology":    geology,
                "temperature_thermal": thermal,
            },
            data_quality=dq,
            uncertainties=uncertainties,
            limitations=_physical_limitations(target.body),
        )
