"""
src/comparison/__init__.py
Public API for the TERRANEXUS Comparison Engine.
"""
from .engine import ComparisonEngine
from .models import EvidenceState, EvidenceType, ComparisonReport

__all__ = ["ComparisonEngine", "EvidenceState", "EvidenceType", "ComparisonReport"]
