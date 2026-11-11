"""
src/processing/terrain.py
Derive terrain attributes (slope, roughness) from elevation rasters.

Works on numpy arrays representing regular grids.
No projection-aware library required for approximate slope; uses central
differences in pixel units and converts using approximate pixel size.
"""
from __future__ import annotations

import logging
from typing import Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Slope
# ---------------------------------------------------------------------------

def compute_slope_degrees(
    elevation: np.ndarray,
    pixel_size_x_m: float,
    pixel_size_y_m: float,
) -> np.ndarray:
    """
    Compute terrain slope in degrees using central differences.

    Args:
        elevation: 2D float array with NaN for nodata
        pixel_size_x_m: Horizontal pixel size in metres (along columns)
        pixel_size_y_m: Vertical pixel size in metres (along rows)

    Returns:
        slope: 2D float32 array of slope in degrees (NaN where elevation is NaN)
    """
    # Replace NaN with 0 for gradient computation (will mask back after)
    e = np.where(np.isnan(elevation), 0.0, elevation)
    nodata_mask = np.isnan(elevation)

    # Central differences (padded at edges)
    dz_dy, dz_dx = np.gradient(e, pixel_size_y_m, pixel_size_x_m)

    slope_rad = np.arctan(np.sqrt(dz_dx**2 + dz_dy**2))
    slope_deg = np.degrees(slope_rad).astype(np.float32)
    slope_deg[nodata_mask] = np.nan
    return slope_deg


# ---------------------------------------------------------------------------
# Roughness (Terrain Ruggedness Index – Riley et al. 1999)
# ---------------------------------------------------------------------------

def compute_roughness_tri(
    elevation: np.ndarray,
    window: int = 3,
) -> np.ndarray:
    """
    Compute Terrain Ruggedness Index (TRI):
      TRI(i,j) = sqrt(sum of squared differences between center cell and its 8 neighbours)

    A window=3 kernel examines a 3×3 neighbourhood.

    Args:
        elevation: 2D float array
        window: kernel size (must be odd, >= 3)

    Returns:
        tri: 2D float32 array of TRI values
    """
    assert window % 2 == 1 and window >= 3, "window must be odd and >= 3"

    try:
        from scipy.ndimage import generic_filter  # type: ignore
    except ImportError:
        logger.warning("scipy not available; TRI computation skipped")
        return np.full_like(elevation, np.nan, dtype=np.float32)

    def _tri_kernel(values: np.ndarray) -> float:
        center = values[len(values) // 2]
        if np.isnan(center):
            return np.nan
        diffs = values - center
        diffs = diffs[~np.isnan(diffs)]
        return float(np.sqrt(np.sum(diffs**2)))

    tri = generic_filter(
        elevation.astype(np.float64),
        _tri_kernel,
        size=window,
        mode="constant",
        cval=np.nan,
    )
    return tri.astype(np.float32)


# ---------------------------------------------------------------------------
# Pixel size calculator for geographic (degree) grids
# ---------------------------------------------------------------------------

def pixel_size_meters(
    lat_center: float,
    resolution_deg: float,
    planet: str = "earth",
) -> Tuple[float, float]:
    """
    Approximate pixel dimensions in metres for a geographic (lon/lat) grid
    at a given latitude.

    Args:
        lat_center: Centre latitude of the area in degrees
        resolution_deg: Grid spacing in degrees
        planet: 'earth', 'mars', or 'moon' (selects correct radius)

    Returns:
        (pixel_size_x_m, pixel_size_y_m)
    """
    RADII_M = {
        "earth": 6_371_000.0,
        "mars": 3_389_500.0,
        "moon": 1_737_400.0,
    }
    R = RADII_M.get(planet.lower(), 6_371_000.0)
    deg_to_rad = np.pi / 180.0
    # Along columns (longitude): pixel shrinks toward poles
    px = R * resolution_deg * deg_to_rad * np.cos(lat_center * deg_to_rad)
    # Along rows (latitude): constant
    py = R * resolution_deg * deg_to_rad
    return float(px), float(py)


# ---------------------------------------------------------------------------
# Regional subset
# ---------------------------------------------------------------------------

def extract_region(
    data: np.ndarray,
    west: float,
    south: float,
    east: float,
    north: float,
    img_west: float = -180.0,
    img_north: float = 90.0,
    resolution_deg: float = 1.0 / 64,
) -> Tuple[np.ndarray, dict]:
    """
    Extract a bounding-box subset from a global 2D array using geographic coordinates.

    Assumes the array is in row-major order with origin at (img_west, img_north)
    and uniform resolution in both directions.
    Supports both [-180, 180] and [0, 360] planetary longitude conventions.

    Returns:
        (subset_array, info_dict)
    """
    nrows, ncols = data.shape

    # Row bounds (North to South)
    row_start = max(0, int(round((img_north - north) / resolution_deg)))
    row_end = min(nrows, int(round((img_north - south) / resolution_deg)))

    # Global longitude coverage
    if (east - west) >= 360.0:
        subset = data[row_start:row_end, 0:ncols]
        info = {
            "row_start": row_start,
            "row_end": row_end,
            "col_start": 0,
            "col_end": ncols,
            "shape": subset.shape,
            "bbox": [west, south, east, north],
        }
        return subset, info

    # Column bounds
    # Handle [0, 360] grid where input coordinates are negative
    if img_west == 0.0 and west < 0 and east <= 0:
        w_norm = west + 360.0
        e_norm = east + 360.0
        col_start = max(0, int(round(w_norm / resolution_deg)))
        col_end = min(ncols, int(round(e_norm / resolution_deg)))
        subset = data[row_start:row_end, col_start:col_end]
    elif img_west == 0.0 and west < 0 and east > 0:
        # Crosses prime meridian in a 0-360 grid
        w_norm = west + 360.0
        col1_start = max(0, int(round(w_norm / resolution_deg)))
        col2_end = min(ncols, int(round(east / resolution_deg)))
        sub1 = data[row_start:row_end, col1_start:ncols]
        sub2 = data[row_start:row_end, 0:col2_end]
        subset = np.concatenate([sub1, sub2], axis=1)
        col_start, col_end = col1_start, col2_end
    else:
        col_start = max(0, int(round((west - img_west) / resolution_deg)))
        col_end = min(ncols, int(round((east - img_west) / resolution_deg)))
        if col_end <= col_start:
            col_end = min(ncols, col_start + 1)
        subset = data[row_start:row_end, col_start:col_end]

    if subset.size == 0 or subset.shape[0] == 0 or subset.shape[1] == 0:
        # Fallback to at least 1 pixel
        subset = data[row_start:max(row_start + 1, row_end), col_start:max(col_start + 1, col_end)]

    info = {
        "row_start": row_start,
        "row_end": row_end,
        "col_start": col_start,
        "col_end": col_end,
        "shape": subset.shape,
        "bbox": [west, south, east, north],
    }
    return subset, info

