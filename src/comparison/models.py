"""
src/comparison/models.py
Data contracts for the TERRANEXUS Comparison Engine.
All dataclasses are JSON-serialisable via dataclasses.asdict().
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ---------------------------------------------------------------------------
# Enumerations — Zehra's official taxonomy
# ---------------------------------------------------------------------------

class EvidenceState(str, Enum):
    SIMILAR             = "SIMILAR"
    DIFFERENT           = "DIFFERENT"
    INSUFFICIENT        = "INSUFFICIENT_EVIDENCE"
    NOT_COMPARABLE      = "NOT_COMPARABLE"


class EvidenceType(str, Enum):
    DIRECT_MEASUREMENT      = "direct_measurement"
    MODEL_DERIVED           = "model_derived"
    CLASSIFICATION_BASED    = "classification_based"
    INDIRECT_INDICATOR      = "indirect_indicator"
    DATUM_INCOMPATIBILITY   = "datum_incompatibility"
    PHYSICS_INCOMPATIBILITY = "physics_incompatibility"
    SENSOR_MISSING          = "sensor_missing"
    REGIONAL_CONTEXT        = "regional_context_only"
    QUALITATIVE_CROSSWALK   = "qualitative_crosswalk"


# ---------------------------------------------------------------------------
# Distribution statistics
# ---------------------------------------------------------------------------

@dataclass
class DistributionStats:
    """Percentile summary of a 1-D numeric distribution."""
    count:  int
    p10:    float
    p25:    float
    p50:    float
    p75:    float
    p90:    float
    mean:   float
    std:    float
    unit:   str = "m"
    source: str = ""

    @property
    def spread(self) -> float:
        return self.p90 - self.p10


# ---------------------------------------------------------------------------
# Single-parameter result
# ---------------------------------------------------------------------------

@dataclass
class ParameterResult:
    parameter:      str
    state:          EvidenceState
    evidence_type:  EvidenceType
    summary:        str
    candidate_stats: Optional[DistributionStats] = None
    target_stats:    Optional[DistributionStats] = None
    overlap_pct:     Optional[float] = None
    wasserstein:     Optional[float] = None
    direction_note:  Optional[str]   = None   # e.g. "Earth steeper by +7.3°"
    detail:          Optional[str]   = None   # extra free-text


# ---------------------------------------------------------------------------
# Dimension-level result (terrain / geology / thermal)
# ---------------------------------------------------------------------------

@dataclass
class DimensionResult:
    dimension:   str                        # e.g. "terrain_topography"
    status:      str                        # human label e.g. "MIXED", "QUALITATIVE", "INSUFFICIENT"
    similarities: list[ParameterResult]    = field(default_factory=list)
    mismatches:   list[ParameterResult]    = field(default_factory=list)
    evidence:     list[ParameterResult]    = field(default_factory=list)


# ---------------------------------------------------------------------------
# Top-level comparison report
# ---------------------------------------------------------------------------

@dataclass
class DataQuality:
    candidate_source:          str
    candidate_resolution_m:    float
    candidate_grid_shape:      list[int]
    candidate_valid_pct:       float
    target_source:             str
    target_resolution_m:       float
    target_grid_shape:         list[int]
    target_valid_pct:          float
    common_baseline_applied:   bool   = False
    common_baseline_note:      str    = "No resampling performed. Resolution disparity documented in uncertainties."
    slope_roughness_source:    str    = "Pre-computed by Abid T S terrain.py pipeline (commit ab3228f)"


@dataclass
class PhysicalLimitation:
    factor:  str
    earth:   str
    target:  str
    impact:  str


@dataclass
class ComparisonReport:
    candidate_id:      str
    location:          dict
    planetary_context: dict
    dimensions:        dict[str, DimensionResult]
    data_quality:      DataQuality
    uncertainties:     list[str]       = field(default_factory=list)
    limitations:       list[PhysicalLimitation] = field(default_factory=list)
    engine_version:    str = "1.0.0"
    framework:         str = "TERRANEXUS"
