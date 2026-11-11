"""
src/processing/cleaner.py
Generic cleaning and standardisation for tabular and array data.

Principles:
- Never silently drop rows; flag with a 'qa_flag' column
- Preserve source identifiers and provenance
- Document every transformation in a processing log
- Do not combine incompatible measurement types
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Column name normaliser
# ---------------------------------------------------------------------------

def normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalise column names: strip whitespace, lowercase, replace spaces/hyphens
    with underscores, remove special characters.
    """
    df = df.copy()
    df.columns = (
        df.columns
        .str.strip()
        .str.lower()
        .str.replace(r"[\s\-]+", "_", regex=True)
        .str.replace(r"[^\w]", "", regex=True)
    )
    return df


# ---------------------------------------------------------------------------
# Missing value handler
# ---------------------------------------------------------------------------

def flag_missing(
    df: pd.DataFrame,
    nodata_values: Optional[List[Any]] = None,
    missing_threshold_pct: float = 50.0,
) -> pd.DataFrame:
    """
    Replace known nodata sentinels with NaN and add a qa_flag column.

    qa_flag values:
      0 = OK
      1 = one or more fields missing/nodata
      9 = row has > threshold % missing values (highly suspect)

    Args:
        df: Input DataFrame
        nodata_values: Values to treat as nodata (e.g. [-9999, -32768, 9999])
        missing_threshold_pct: Rows with > this % NaN fields get qa_flag=9
    """
    df = df.copy()

    if nodata_values:
        for val in nodata_values:
            df = df.replace(val, np.nan)

    missing_pct = df.isnull().mean(axis=1) * 100
    df["qa_flag"] = 0
    df.loc[df.isnull().any(axis=1), "qa_flag"] = 1
    df.loc[missing_pct > missing_threshold_pct, "qa_flag"] = 9

    n_flagged = (df["qa_flag"] > 0).sum()
    logger.info("Flagged %d rows with QA issues (%.1f%%)", n_flagged, 100 * n_flagged / len(df))
    return df


# ---------------------------------------------------------------------------
# Coordinate validator
# ---------------------------------------------------------------------------

def validate_coordinates(
    df: pd.DataFrame,
    lon_col: str = "longitude",
    lat_col: str = "latitude",
    lon_range: tuple = (-180.0, 180.0),
    lat_range: tuple = (-90.0, 90.0),
) -> pd.DataFrame:
    """
    Flag rows with missing or out-of-range coordinates.
    Sets qa_flag=2 for coordinate problems (stacks with existing flags).
    """
    df = df.copy()
    if "qa_flag" not in df.columns:
        df["qa_flag"] = 0

    if lon_col not in df.columns or lat_col not in df.columns:
        logger.warning("Coordinate columns not found: %s, %s", lon_col, lat_col)
        return df

    bad_lon = df[lon_col].isnull() | (df[lon_col] < lon_range[0]) | (df[lon_col] > lon_range[1])
    bad_lat = df[lat_col].isnull() | (df[lat_col] < lat_range[0]) | (df[lat_col] > lat_range[1])
    bad_coords = bad_lon | bad_lat

    df.loc[bad_coords, "qa_flag"] = df.loc[bad_coords, "qa_flag"].clip(lower=2)
    n_bad = bad_coords.sum()
    if n_bad:
        logger.warning("%d rows have invalid coordinates", n_bad)
    return df


# ---------------------------------------------------------------------------
# Duplicate detector
# ---------------------------------------------------------------------------

def flag_duplicates(
    df: pd.DataFrame,
    subset: Optional[List[str]] = None,
) -> pd.DataFrame:
    """
    Mark duplicate rows with qa_flag=3.
    Does not drop duplicates – preserves all rows for audit.
    """
    df = df.copy()
    if "qa_flag" not in df.columns:
        df["qa_flag"] = 0

    dup_mask = df.duplicated(subset=subset, keep="first")
    df.loc[dup_mask, "qa_flag"] = df.loc[dup_mask, "qa_flag"].clip(lower=3)
    n_dups = dup_mask.sum()
    if n_dups:
        logger.warning("Found %d duplicate rows", n_dups)
    return df


# ---------------------------------------------------------------------------
# Range validator
# ---------------------------------------------------------------------------

def validate_ranges(
    df: pd.DataFrame,
    range_specs: Dict[str, tuple],
) -> pd.DataFrame:
    """
    Flag rows where a numeric column falls outside expected physical range.

    Args:
        df: Input DataFrame
        range_specs: dict mapping column name to (min, max) valid range
                     e.g. {"temperature_k": (0, 700), "elevation_m": (-12000, 9000)}
    """
    df = df.copy()
    if "qa_flag" not in df.columns:
        df["qa_flag"] = 0

    for col, (lo, hi) in range_specs.items():
        if col not in df.columns:
            continue
        out_of_range = df[col].notna() & ((df[col] < lo) | (df[col] > hi))
        df.loc[out_of_range, "qa_flag"] = df.loc[out_of_range, "qa_flag"].clip(lower=1)
        if out_of_range.any():
            logger.warning(
                "Column '%s': %d out-of-range values (valid: [%s, %s])",
                col, out_of_range.sum(), lo, hi,
            )
    return df


# ---------------------------------------------------------------------------
# Processing report builder
# ---------------------------------------------------------------------------

class ProcessingReport:
    """Accumulate transformation steps and produce a summary dict."""

    def __init__(self, dataset_id: str):
        self.dataset_id = dataset_id
        self.steps: list[dict] = []

    def log(self, step: str, detail: Any = None) -> None:
        self.steps.append({"step": step, "detail": detail})
        logger.info("[%s] %s: %s", self.dataset_id, step, detail)

    def to_dict(self) -> dict:
        return {"dataset_id": self.dataset_id, "steps": self.steps}
