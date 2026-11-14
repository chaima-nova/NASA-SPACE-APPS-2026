"""
src/comparison/geology_crosswalk.py
Match a region_id to its geological class and generate ParameterResults
for the geological units dimension.
"""
from __future__ import annotations
from .loader import load_crosswalk
from .models import EvidenceState, EvidenceType, ParameterResult


def _get_region(crosswalk: dict, region_id: str) -> dict | None:
    return crosswalk.get("region_assignments", {}).get(region_id)


def evaluate_geological_units(candidate_id: str, target_id: str) -> list[ParameterResult]:
    """
    Returns a list of ParameterResults for the geology dimension.
    - geological_units   → qualitative crosswalk comparison
    - surface_material   → INSUFFICIENT_EVIDENCE (not ingested)
    - mineralogy         → INSUFFICIENT_EVIDENCE (not ingested)
    """
    crosswalk = load_crosswalk()
    cand = _get_region(crosswalk, candidate_id)
    targ = _get_region(crosswalk, target_id)

    results: list[ParameterResult] = []

    # --- geological_units ---
    if cand and targ:
        c_primary = cand["primary_class"]
        t_primary = targ["primary_class"]
        c_label   = cand["description"]
        t_label   = targ["description"]
        c_lf      = ", ".join(cand.get("landforms", []))
        t_lf      = ", ".join(targ.get("landforms", []))

        # Broad class match?
        shared = set([cand["primary_class"], cand.get("secondary_class", "")]) & \
                 set([targ["primary_class"], targ.get("secondary_class", "")])
        if shared:
            state = EvidenceState.SIMILAR
            summary = (
                f"Shared geological class(es): {', '.join(shared)}. "
                f"Candidate: {c_label}. Landforms: {c_lf}. "
                f"Target: {t_label}. Landforms: {t_lf}."
            )
        else:
            state = EvidenceState.DIFFERENT
            summary = (
                f"No shared geological class. "
                f"Candidate primary: {c_primary} ({c_label}). "
                f"Target primary: {t_primary} ({t_label})."
            )

        results.append(ParameterResult(
            parameter="geological_units",
            state=state,
            evidence_type=EvidenceType.QUALITATIVE_CROSSWALK,
            summary=summary,
            detail=(
                "Draft crosswalk built from USGS map group names only "
                "(Fortezzo et al. 2020; Tanaka et al. 2014). "
                f"Confidence: {cand.get('confidence', 'low')}. "
                "Full unit descriptions not yet verified."
            ),
        ))
    else:
        results.append(ParameterResult(
            parameter="geological_units",
            state=EvidenceState.INSUFFICIENT,
            evidence_type=EvidenceType.CLASSIFICATION_BASED,
            summary="Region not found in crosswalk. Manual classification required.",
        ))

    # --- surface_material ---
    results.append(ParameterResult(
        parameter="surface_material_rock_abundance",
        state=EvidenceState.INSUFFICIENT,
        evidence_type=EvidenceType.SENSOR_MISSING,
        summary="Rock abundance data not yet ingested for any body.",
        detail=(
            "Moon: Diviner GDR Level 3 Rock Abundance (60°S–60°N, 32 ppd) not ingested. "
            "Mars: THEMIS thermal inertia not ingested. "
            "Earth: no rock abundance product confirmed."
        ),
    ))

    # --- mineralogical_indicators ---
    results.append(ParameterResult(
        parameter="mineralogical_indicators",
        state=EvidenceState.INSUFFICIENT,
        evidence_type=EvidenceType.SENSOR_MISSING,
        summary="Mineralogical indicator data not yet ingested for any body.",
        detail=(
            "Moon: Diviner Christiansen Feature position not ingested. "
            "Mars: TES mineral maps (4 ppd, ~16 km) not ingested. "
            "Earth: no spectral mineral product confirmed."
        ),
    ))

    return results
