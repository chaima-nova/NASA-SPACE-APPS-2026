"""
src/comparison/terrain_metrics.py
Compute windowed local relief from elevation .npy grids.
Slope and roughness are read directly from Abid's pre-computed .npy files.
"""
from __future__ import annotations
import numpy as np
from scipy.ndimage import generic_filter


def _relief_kernel(values: np.ndarray) -> float:
    """Max minus min of valid values in a window."""
    valid = values[~np.isnan(values)]
    if len(valid) < 2:
        return np.nan
    return float(np.max(valid) - np.min(valid))


def compute_windowed_relief(
    elevation: np.ndarray,
    window_px: int = 3,
) -> np.ndarray:
    """
    Sliding-window local relief: Δh = h_max − h_min within a square window.

    Args:
        elevation:  2D float32 array with NaN for nodata.
        window_px:  Side length in pixels (e.g. 3 → 3×3 = 9-cell window).

    Returns:
        2D float32 relief array, NaN where insufficient valid neighbours.
    """
    result = generic_filter(
        elevation.astype(np.float64),
        _relief_kernel,
        size=window_px,
        mode="constant",
        cval=np.nan,
    )
    return result.astype(np.float32)


def flat_valid(arr: np.ndarray) -> np.ndarray:
    """Return a 1-D array of all non-NaN values."""
    return arr[~np.isnan(arr)].ravel()
