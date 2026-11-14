"""
src/comparison/thermal_evaluator.py
Thermal dimension evaluation for the TERRANEXUS Comparison Engine.

All three thermal parameters are INSUFFICIENT_EVIDENCE or NOT_COMPARABLE
for the demo — no thermal data has been ingested for any body.
This module enforces correct scientific states and reason strings.
"""
from __future__ import annotations
from .models import EvidenceState, EvidenceType, ParameterResult


_THEMIS_NOTE = (
    "ASU THEMIS Day IR mosaics are 8-bit PNG image tiles with no temperature units "
    "or calibration scale factor — they are pictures, not numeric measurements."
)

_DIVINER_NOTE = (
    "LRO Diviner GDR Level 2 calibrated brightness temperatures "
    "not yet ingested into the pipeline."
)

_TES_NOTE = (
    "MGS TES thermal inertia binary (nmap2003.bin + interpolation mask) "
    "not yet ingested. Reader implemented in src/processing/pds_reader.py "
    "but file not present on disk."
)

_HAYNE_NOTE = (
    "Lunar thermal inertia map (Hayne et al. 2017, JGR Planets 122) "
    "not yet downloaded or ingested."
)

_EARTH_LST_NOTE = (
    "Earth land surface temperature product (ECOSTRESS / MODIS MOD11A2) "
    "not yet ingested — requires NASA Earthdata credentials."
)

_PHYSICS_NOTE = (
    "Direct cross-body temperature comparison is NOT COMPARABLE: "
    "Earth has a 1,013 hPa convective atmosphere; Mars ~6 hPa CO₂; Moon is hard vacuum. "
    "Thermal physics, atmospheric buffering, and local solar time sampling differ fundamentally."
)


def evaluate_thermal(target_body: str) -> list[ParameterResult]:
    """
    Returns the three thermal ParameterResults for a given target body.
    Args:
        target_body: "moon" or "mars"
    """
    results: list[ParameterResult] = []

    # --- surface_temperature ---
    if target_body == "moon":
        detail = f"{_EARTH_LST_NOTE} {_DIVINER_NOTE}"
    else:
        detail = f"{_EARTH_LST_NOTE} THEMIS: {_THEMIS_NOTE}"

    results.append(ParameterResult(
        parameter="surface_temperature",
        state=EvidenceState.INSUFFICIENT,
        evidence_type=EvidenceType.SENSOR_MISSING,
        summary="Surface temperature data not available for candidate or target.",
        detail=detail,
    ))

    # --- day_night_amplitude ---
    if target_body == "moon":
        amplitude_detail = (
            f"{_DIVINER_NOTE} Published sanity values: ~400 K at noon, <100 K at night near equator. "
            "Polar Diviner L2 products extend to 75°S."
        )
    else:
        amplitude_detail = (
            "No calibrated numeric Mars day/night temperature pair available. "
            f"{_THEMIS_NOTE} "
            "Published sanity value: Jezero ~−83°C before dawn, ~+5°C at noon (NASA MEDA)."
        )

    results.append(ParameterResult(
        parameter="day_night_thermal_amplitude",
        state=EvidenceState.INSUFFICIENT,
        evidence_type=EvidenceType.SENSOR_MISSING,
        summary="Day/night temperature pair not available for candidate or target.",
        detail=amplitude_detail,
    ))

    # --- thermal_inertia + NOT_COMPARABLE note for cross-body ---
    if target_body == "moon":
        ti_detail = _HAYNE_NOTE
    else:
        ti_detail = (
            f"{_TES_NOTE} "
            "USGS 8-bit THEMIS mosaic is qualitative only. "
            "When ingested, compare only as ordered classes with interpolation mask applied."
        )

    results.append(ParameterResult(
        parameter="thermal_inertia",
        state=EvidenceState.INSUFFICIENT,
        evidence_type=EvidenceType.SENSOR_MISSING,
        summary="Thermal inertia data not yet ingested for any body.",
        detail=ti_detail,
    ))

    # --- physics incompatibility note (always present) ---
    results.append(ParameterResult(
        parameter="atmospheric_thermal_physics",
        state=EvidenceState.NOT_COMPARABLE,
        evidence_type=EvidenceType.PHYSICS_INCOMPATIBILITY,
        summary=_PHYSICS_NOTE,
    ))

    return results
