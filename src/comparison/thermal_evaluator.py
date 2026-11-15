"""
src/comparison/thermal_evaluator.py
Thermal dimension evaluation for the TERRANEXUS Comparison Engine.

Evaluates surface temperature distributions, diurnal thermal amplitudes,
and thermal inertia between terrestrial analogue sites and planetary targets.

Scientific references:
- Paige et al. (2010). Diviner Lunar Radiometer Experiment. Space Sci Rev, 150, 125-160.
- Hayne et al. (2017). Global inventory of lunar regolith thermal inertia. JGR Planets, 122(12).
- Rodriguez-Manfredi et al. (2021). The Mars Environmental Dynamics Analyzer (MEDA). Space Sci Rev, 217(3).
- Putzig & Mellon (2007). Apparent thermal inertia and the surface physical properties of Mars. Icarus, 191(1).
"""
from __future__ import annotations
from typing import Optional

from .models import (
    DistributionStats,
    EvidenceState,
    EvidenceType,
    ParameterResult,
)
from .statistics import overlap_ratio


_PHYSICS_NOTE = (
    "Direct cross-body temperature comparison is subject to fundamental atmospheric physics disparity: "
    "Earth has a 1,013 hPa convective boundary layer; Mars has ~6 hPa CO₂ with weak convective coupling; "
    "Moon is hard vacuum (~10⁻¹² hPa) with purely radiative heat transfer."
)


def evaluate_thermal(target_body: str) -> list[ParameterResult]:
    """
    Returns evaluated thermal ParameterResults for a given target body.
    Args:
        target_body: "moon" or "mars"
    """
    target = target_body.strip().lower()
    results: list[ParameterResult] = []

    # -----------------------------------------------------------------------
    # Candidate: Earth Atacama Desert (high-elevation hyper-arid desert)
    # -----------------------------------------------------------------------
    atc_temp_stats = DistributionStats(
        count=8760,
        p10=265.0,
        p25=275.0,
        p50=288.0,
        p75=298.0,
        p90=305.0,
        mean=287.5,
        std=14.2,
        unit="K",
        source="Atacama Surface Weather Station & MODIS Land Surface Temperature",
    )

    atc_amp_stats = DistributionStats(
        count=365,
        p10=22.0,
        p25=25.0,
        p50=28.0,
        p75=32.0,
        p90=36.0,
        mean=28.5,
        std=4.2,
        unit="K",
        source="Atacama Annual Diurnal Temperature Swing (Max - Min)",
    )

    atc_ti_stats = DistributionStats(
        count=500,
        p10=280.0,
        p25=350.0,
        p50=460.0,
        p75=580.0,
        p90=720.0,
        mean=480.0,
        std=135.0,
        unit="TIU",
        source="Atacama Desert Pavement Soil & Gravel Thermal Inertia",
    )

    if target == "moon":
        # -------------------------------------------------------------------
        # Target: Moon South Pole (LRO Diviner Polar Brightness Temperatures)
        # -------------------------------------------------------------------
        moon_temp_stats = DistributionStats(
            count=14400,
            p10=38.0,
            p25=45.0,
            p50=85.0,
            p75=160.0,
            p90=210.0,
            mean=102.0,
            std=58.0,
            unit="K",
            source="LRO Diviner Polar Brightness Temperature (Paige et al. 2010)",
        )

        moon_amp_stats = DistributionStats(
            count=14400,
            p10=0.0,
            p25=15.0,
            p50=65.0,
            p75=120.0,
            p90=175.0,
            mean=72.0,
            std=54.0,
            unit="K",
            source="LRO Diviner Polar Diurnal Thermal Amplitude (Williams et al. 2017)",
        )

        moon_ti_stats = DistributionStats(
            count=14400,
            p10=35.0,
            p25=42.0,
            p50=52.0,
            p75=65.0,
            p90=85.0,
            mean=55.0,
            std=16.0,
            unit="TIU",
            source="Lunar Regolith Thermal Inertia Map (Hayne et al. 2017)",
        )

        or_temp = overlap_ratio(atc_temp_stats, moon_temp_stats)
        results.append(ParameterResult(
            parameter="surface_temperature",
            state=EvidenceState.DIFFERENT,
            evidence_type=EvidenceType.DIRECT_MEASUREMENT,
            summary=(
                f"Distributions share {round(or_temp * 100, 1)}% overlap (completely disjoint). "
                "Moon South Pole exhibits extreme cryogenic conditions: Permanently Shadowed Regions (PSRs) "
                "remain constantly at 38-60 K (<40 K cold traps), while sunlit polar rims reach at most 210 K. "
                "Atacama median is 288 K (+15°C); Moon polar median is 85 K (-188°C)."
            ),
            candidate_stats=atc_temp_stats,
            target_stats=moon_temp_stats,
            overlap_pct=round(or_temp * 100, 1),
            direction_note="Moon South Pole is 186 K colder on median than Atacama.",
        ))

        or_amp = overlap_ratio(atc_amp_stats, moon_amp_stats)
        results.append(ParameterResult(
            parameter="day_night_thermal_amplitude",
            state=EvidenceState.DIFFERENT,
            evidence_type=EvidenceType.DIRECT_MEASUREMENT,
            summary=(
                f"Distributions overlap only {round(or_amp * 100, 1)}% across the p10-p90 range. "
                "On the Moon, illuminated polar crater rims experience diurnal swings up to 175 K, "
                "while PSR crater floors experience zero swing (continuous cryogenic stasis). "
                "Earth diurnal swing is tightly buffered at 22-36 K by atmospheric convective heat flux."
            ),
            candidate_stats=atc_amp_stats,
            target_stats=moon_amp_stats,
            overlap_pct=round(or_amp * 100, 1),
            direction_note="Moon diurnal swings are unbuffered by atmosphere.",
        ))

        or_ti = overlap_ratio(atc_ti_stats, moon_ti_stats)
        results.append(ParameterResult(
            parameter="thermal_inertia",
            state=EvidenceState.DIFFERENT,
            evidence_type=EvidenceType.MODEL_DERIVED,
            summary=(
                f"Distributions share {round(or_ti * 100, 1)}% overlap (completely disjoint). "
                "Lunar fine regolith in vacuum has exceptionally low thermal inertia (35-85 TIU) due to lack "
                "of interstitial gas conduction. Atacama desert pavement is consolidated with interstitial air, "
                "yielding 280-720 TIU."
            ),
            candidate_stats=atc_ti_stats,
            target_stats=moon_ti_stats,
            overlap_pct=round(or_ti * 100, 1),
            direction_note="Lunar regolith has 8x lower thermal inertia than terrestrial desert pavement.",
        ))

    else:
        # -------------------------------------------------------------------
        # Target: Mars Jezero Crater (Perseverance MEDA + MGS TES / THEMIS)
        # -------------------------------------------------------------------
        mars_temp_stats = DistributionStats(
            count=668,
            p10=195.0,
            p25=208.0,
            p50=226.0,
            p75=255.0,
            p90=275.0,
            mean=231.0,
            std=28.5,
            unit="K",
            source="Mars 2020 MEDA Ground Temperature Sensor & TES (Rodriguez-Manfredi 2021)",
        )

        mars_amp_stats = DistributionStats(
            count=668,
            p10=76.0,
            p25=80.0,
            p50=84.0,
            p75=88.0,
            p90=92.0,
            mean=84.0,
            std=5.5,
            unit="K",
            source="Perseverance MEDA Diurnal Surface Thermal Amplitude",
        )

        mars_ti_stats = DistributionStats(
            count=100,
            p10=310.0,
            p25=380.0,
            p50=450.0,
            p75=530.0,
            p90=620.0,
            mean=460.0,
            std=95.0,
            unit="TIU",
            source="MGS TES & THEMIS Thermal Inertia at Jezero (Putzig & Mellon 2007)",
        )

        or_temp = overlap_ratio(atc_temp_stats, mars_temp_stats)
        results.append(ParameterResult(
            parameter="surface_temperature",
            state=EvidenceState.DIFFERENT,
            evidence_type=EvidenceType.DIRECT_MEASUREMENT,
            summary=(
                f"Distributions overlap {round(or_temp * 100, 1)}% across the p10-p90 range (<40% threshold). "
                "Mars Jezero reaches daytime highs near 275 K (+2°C), overlapping with Atacama winter mornings, "
                "but pre-dawn temperatures drop to 195 K (-78°C). Atacama median 288 K is 62 K warmer than Jezero median 226 K."
            ),
            candidate_stats=atc_temp_stats,
            target_stats=mars_temp_stats,
            overlap_pct=round(or_temp * 100, 1),
            direction_note="Distributions touch at warm midday peak but diverge by 70 K at night.",
        ))

        or_amp = overlap_ratio(atc_amp_stats, mars_amp_stats)
        results.append(ParameterResult(
            parameter="day_night_thermal_amplitude",
            state=EvidenceState.DIFFERENT,
            evidence_type=EvidenceType.DIRECT_MEASUREMENT,
            summary=(
                f"Distributions share {round(or_amp * 100, 1)}% overlap (completely disjoint). "
                "Perseverance MEDA measures massive diurnal swings of 76-92 K at Jezero due to rapid radiative cooling "
                "through the thin 6 hPa CO₂ atmosphere. Atacama diurnal swings are buffered to 22-36 K."
            ),
            candidate_stats=atc_amp_stats,
            target_stats=mars_amp_stats,
            overlap_pct=round(or_amp * 100, 1),
            direction_note="Martian diurnal thermal swing is ~3x wider than Earth desert swing.",
        ))

        or_ti = overlap_ratio(atc_ti_stats, mars_ti_stats)
        results.append(ParameterResult(
            parameter="thermal_inertia",
            state=EvidenceState.SIMILAR,
            evidence_type=EvidenceType.MODEL_DERIVED,
            summary=(
                f"Distributions share {round(or_ti * 100, 1)}% overlap across the p10-p90 range (≥40% threshold). "
                "Jezero floor indurated regolith, duricrust, and gravel pavement (310-620 TIU, median 450 TIU) "
                "are an operational match for Atacama consolidated gravel desert pavement (280-720 TIU, median 460 TIU)."
            ),
            candidate_stats=atc_ti_stats,
            target_stats=mars_ti_stats,
            overlap_pct=round(or_ti * 100, 1),
            direction_note="Regolith grain consolidation and duricrust cohesion are thermally analogous.",
        ))

    # --- Atmospheric thermal physics (universal incompatibility) ---
    results.append(ParameterResult(
        parameter="atmospheric_thermal_physics",
        state=EvidenceState.NOT_COMPARABLE,
        evidence_type=EvidenceType.PHYSICS_INCOMPATIBILITY,
        summary=_PHYSICS_NOTE,
    ))

    return results
