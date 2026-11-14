"""
scripts/build_samples.py
──────────────────────────────────────────────────────────────────────────────
Stage 6: Build small, ready-to-use sample datasets from raw/interim files.

Outputs to data/samples/:
  - {dataset_id}_{planet}_sample.csv     (gridded values with lat/lon)
  - {dataset_id}_{planet}_sample.npy     (numpy binary)
  - {dataset_id}_{planet}_stats.json     (statistics)
  - data_dictionary.csv                  (field definitions)
  - load_{dataset_id}_{planet}.py        (loading examples)

SYNTHETIC EARTH ANALOGUE DATASET:
  Because SRTM (Earth elevation) requires Earthdata credentials, we also
  generate a DOCUMENTED synthetic Earth analogue sample that clearly
  identifies itself as synthetic and documents what real data looks like.
  This lets teammates begin exploration immediately while credentials are obtained.

Usage:
  python scripts/build_samples.py
  python scripts/build_samples.py --dataset lola_64ppd
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

import numpy as np
import pandas as pd

from src.processing.pds_reader import read_pds3_img
from src.processing.terrain import (
    compute_slope_degrees,
    compute_roughness_tri,
    extract_region,
    pixel_size_meters,
)
from src.processing.sample_builder import (
    build_data_dictionary,
    sample_raster_region,
    write_loading_example,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(ROOT / "reports" / "pipeline.log", mode="a"),
    ],
)
logger = logging.getLogger("build_samples")

SAMPLES_DIR = ROOT / "data" / "samples"
SAMPLES_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# LOLA 64ppd – Moon sample
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# LOLA – Moon sample
# ---------------------------------------------------------------------------

def build_lola_sample() -> dict:
    """Build Moon elevation sample from real LOLA GDR."""
    raw_dir = ROOT / "data" / "raw" / "moon" / "lola_64ppd"
    img_candidates = list(raw_dir.glob("*.img")) + list((ROOT / "data" / "raw" / "moon" / "lola").glob("*.img"))

    if not img_candidates:
        return {"dataset_id": "lola_64ppd", "status": "skipped_missing_input",
                "reason": "Run: python scripts/download_data.py --dataset lola_64ppd"}

    img = img_candidates[0]
    lbl = img.with_suffix(".lbl")
    if not lbl.exists():
        lbl = img.with_suffix(".LBL")

    logger.info("Building LOLA sample from %s...", img.name)
    read = read_pds3_img(img, lbl)
    if read["error"]:
        return {"dataset_id": "lola_64ppd", "status": "error", "error": read["error"]}

    data = read["data"]
    nrows, ncols = data.shape
    res_deg = 180.0 / nrows  # 0.25 deg for 720 rows (4ppd), 1/64 deg for 11520 rows

    # Load region from settings.json or use verified fallback
    settings_file = ROOT / "config" / "settings.json"
    moon_bbox = [0.0, -90.0, 360.0, -80.0]
    region_name = "Lunar South Pole"
    if settings_file.exists():
        try:
            with open(settings_file, "r", encoding="utf-8") as fh:
                s_cfg = json.load(fh)
                m_roi = s_cfg.get("regions_of_interest", {}).get("moon", {})
                moon_bbox = m_roi.get("bbox", moon_bbox)
                region_name = m_roi.get("name", region_name)
        except Exception as e:
            logger.warning("Could not read settings.json for Moon bbox: %s", e)

    south_pole_region = {
        "west": moon_bbox[0], "south": moon_bbox[1], "east": moon_bbox[2], "north": moon_bbox[3],
        "name": region_name,
    }
    subset, info = extract_region(
        data,
        west=south_pole_region["west"], south=south_pole_region["south"],
        east=south_pole_region["east"], north=south_pole_region["north"],
        img_west=read.get("img_west", 0.0), img_north=read.get("img_north", 90.0),
        resolution_deg=res_deg,
    )

    nsr, nsc = subset.shape
    lons = south_pole_region["west"] + (np.arange(nsc) + 0.5) * res_deg
    lats = south_pole_region["north"] - (np.arange(nsr) + 0.5) * res_deg

    # Compute physical pixel dimensions accurately per latitude row
    # (Avoids severe distortion near the pole where longitudinal width shrinks to < 50m)
    R_moon = 1_737_400.0
    deg_to_rad = np.pi / 180.0
    px_m_rows = R_moon * res_deg * deg_to_rad * np.cos(np.radians(lats))
    py_m = R_moon * res_deg * deg_to_rad

    slope = compute_slope_degrees(subset, px_m_rows, py_m)
    tri = compute_roughness_tri(subset)

    # Build CSV with coordinates, elevation, slope, TRI
    lon_grid, lat_grid = np.meshgrid(lons, lats)

    df = pd.DataFrame({
        "latitude": lat_grid.ravel(),
        "longitude": lon_grid.ravel(),
        "elevation_m": subset.ravel(),
        "slope_deg": slope.ravel(),
        "roughness_tri_m": tri.ravel(),
        "planet": "moon",
        "region": "Lunar South Pole",
        "source": f"LOLA_GDR_{img.stem.upper()}",
        "datum": "Lunar mean sphere (R=1737.4 km)",
        "crs": "IAU 2015 Moon body-fixed selenographic",
        "data_type": "REAL_SCIENTIFIC_MEASUREMENT",
    })

    # Drop any NaN rows
    df = df.dropna(subset=["elevation_m"]).reset_index(drop=True)

    # Sample up to 25,000 rows for lightweight teammate handoff
    if len(df) > 25_000:
        df_sample = df.sample(25_000, random_state=42).reset_index(drop=True)
    else:
        df_sample = df

    csv_path = SAMPLES_DIR / "lola_moon_south_pole_sample.csv"
    df_sample.to_csv(csv_path, index=False, float_format="%.3f")
    logger.info("Saved: %s (%d rows)", csv_path.name, len(df_sample))

    # Save numpy 2D array grids (elevation, slope, roughness) for windowed spatial analysis
    npy_path = SAMPLES_DIR / "lola_moon_south_pole_elevation.npy"
    np.save(npy_path, subset)
    np.save(SAMPLES_DIR / "lola_moon_south_pole_slope.npy", slope)
    np.save(SAMPLES_DIR / "lola_moon_south_pole_roughness.npy", tri)

    # Stats JSON
    stats = {
        "dataset_id": "lola_gdr",
        "planet": "moon",
        "product_file": img.name,
        "region": "Lunar South Pole",
        "data_type": "REAL_SCIENTIFIC_MEASUREMENT",
        "bbox": [south_pole_region["west"], south_pole_region["south"],
                 south_pole_region["east"], south_pole_region["north"]],
        "grid_resolution_deg": round(res_deg, 4),
        "elevation_m": {
            "min": round(float(np.nanmin(subset)), 1),
            "max": round(float(np.nanmax(subset)), 1),
            "mean": round(float(np.nanmean(subset)), 1),
            "std": round(float(np.nanstd(subset)), 1),
        },
        "slope_deg": {
            "min": round(float(np.nanmin(slope)), 2),
            "max": round(float(np.nanmax(slope)), 2),
            "mean": round(float(np.nanmean(slope)), 2),
        },
        "roughness_tri_m": {
            "min": round(float(np.nanmin(tri)), 2),
            "max": round(float(np.nanmax(tri)), 2),
            "mean": round(float(np.nanmean(tri)), 2),
        },
        "sample_rows": len(df_sample),
        "source_citation": "Smith et al. (2010). Initial observations from the Lunar Orbiter Laser Altimeter (LOLA). GRL.",
    }
    stats_path = SAMPLES_DIR / "lola_moon_stats.json"
    with open(stats_path, "w", encoding="utf-8") as fh:
        json.dump(stats, fh, indent=2)

    # Data dictionary
    build_data_dictionary(
        [
            {"field_name": "latitude", "description": "Pixel centre latitude", "units": "degrees selenographic (north positive)",
             "dtype": "float64", "valid_range": "[-90, -80]", "nodata_value": "NaN", "source": "LOLA GDR"},
            {"field_name": "longitude", "description": "Pixel centre longitude", "units": "degrees selenographic (east positive 0-360)",
             "dtype": "float64", "valid_range": "[0, 360]", "nodata_value": "NaN", "source": "LOLA GDR"},
            {"field_name": "elevation_m", "description": "Surface elevation above LOLA mean lunar radius (1737.4 km)",
             "units": "meters", "dtype": "float32", "valid_range": "[-9000, 10000]", "nodata_value": "NaN", "source": "LOLA GDR"},
            {"field_name": "slope_deg", "description": "Terrain slope computed by central difference of elevation",
             "units": "degrees", "dtype": "float32", "valid_range": "[0, 90]", "nodata_value": "NaN", "source": "Derived"},
            {"field_name": "roughness_tri_m", "description": "Terrain Ruggedness Index (Riley et al. 1999) 3x3 kernel",
             "units": "meters", "dtype": "float32", "valid_range": "[0, 5000]", "nodata_value": "NaN", "source": "Derived"},
            {"field_name": "planet", "description": "Planetary body identifier", "units": "text", "dtype": "str"},
            {"field_name": "datum", "description": "Elevation vertical reference surface", "units": "text", "dtype": "str"},
        ],
        SAMPLES_DIR / "lola_moon_data_dictionary.csv",
    )

    write_loading_example(
        dataset_id="lola_gdr", planet="moon",
        csv_path=csv_path, out_path=SAMPLES_DIR / "load_lola_moon.py",
        variable="elevation_m", units="meters",
    )

    return {
        "dataset_id": "lola_gdr",
        "status": "success",
        "files": {
            "csv": str(csv_path),
            "npy": str(npy_path),
            "stats": str(stats_path),
            "dictionary": str(SAMPLES_DIR / "lola_moon_data_dictionary.csv"),
            "loading_example": str(SAMPLES_DIR / "load_lola_moon.py"),
        },
        "sample_rows": len(df_sample),
        "statistics": stats,
    }


# ---------------------------------------------------------------------------
# MOLA – Mars sample
# ---------------------------------------------------------------------------

def build_mola_sample() -> dict:
    """Build Mars elevation sample from real MOLA MEGaDR."""
    raw_dir = ROOT / "data" / "raw" / "mars" / "mola_meg128"
    img_candidates = list(raw_dir.glob("*.img"))

    if not img_candidates:
        return {"dataset_id": "mola_megdr", "status": "skipped_missing_input",
                "reason": "Run: python scripts/download_data.py --dataset mola_meg128"}

    img = img_candidates[0]
    lbl = img.with_suffix(".lbl")
    if not lbl.exists():
        lbl = img.with_suffix(".LBL")

    logger.info("Building MOLA sample from %s (Jezero Crater region)...", img.name)
    read = read_pds3_img(img, lbl)
    if read["error"]:
        return {"dataset_id": "mola_megdr", "status": "error", "error": read["error"]}

    data = read["data"]
    nrows, ncols = data.shape
    res_deg = 180.0 / nrows  # 0.25 deg for 4ppd

    # Load Mars region from settings.json
    settings_file = ROOT / "config" / "settings.json"
    jezero_bbox = [76.0, 17.0, 79.0, 20.0]
    region_name = "Jezero Crater"
    if settings_file.exists():
        try:
            with open(settings_file, "r", encoding="utf-8") as fh:
                s_cfg = json.load(fh)
                m_roi = s_cfg.get("regions_of_interest", {}).get("mars", {})
                jezero_bbox = m_roi.get("bbox", jezero_bbox)
                region_name = m_roi.get("name", region_name)
        except Exception as e:
            logger.warning("Could not read settings.json for Mars bbox: %s", e)

    jezero = {"west": jezero_bbox[0], "south": jezero_bbox[1], "east": jezero_bbox[2], "north": jezero_bbox[3], "name": region_name}
    subset, info = extract_region(
        data,
        west=jezero["west"], south=jezero["south"],
        east=jezero["east"], north=jezero["north"],
        img_west=read.get("img_west", 0.0), img_north=read.get("img_north", 90.0),
        resolution_deg=res_deg,
    )

    lat_center = (jezero["south"] + jezero["north"]) / 2.0
    px_m, py_m = pixel_size_meters(lat_center, res_deg, "mars")
    slope = compute_slope_degrees(subset, px_m, py_m)
    tri = compute_roughness_tri(subset)

    nsr, nsc = subset.shape
    lons = jezero["west"] + (np.arange(nsc) + 0.5) * res_deg
    lats = jezero["north"] - (np.arange(nsr) + 0.5) * res_deg
    lon_grid, lat_grid = np.meshgrid(lons, lats)

    df = pd.DataFrame({
        "latitude": lat_grid.ravel(),
        "longitude": lon_grid.ravel(),
        "elevation_m": subset.ravel(),
        "slope_deg": slope.ravel(),
        "roughness_tri_m": tri.ravel(),
        "planet": "mars",
        "region": "Jezero Crater",
        "source": f"MOLA_MEGADR_{img.stem.upper()}",
        "datum": "Mars areoid (GMM-2B gravity datum)",
        "crs": "IAU 2015 Mars body-fixed areographic",
        "data_type": "REAL_SCIENTIFIC_MEASUREMENT",
    })

    df = df.dropna(subset=["elevation_m"]).reset_index(drop=True)

    csv_path = SAMPLES_DIR / "mola_mars_jezero_sample.csv"
    df.to_csv(csv_path, index=False, float_format="%.3f")
    logger.info("Saved: %s (%d rows)", csv_path.name, len(df))

    npy_path = SAMPLES_DIR / "mola_mars_jezero_elevation.npy"
    np.save(npy_path, subset)
    np.save(SAMPLES_DIR / "mola_mars_jezero_slope.npy", slope)
    np.save(SAMPLES_DIR / "mola_mars_jezero_roughness.npy", tri)

    stats = {
        "dataset_id": "mola_megdr",
        "planet": "mars",
        "product_file": img.name,
        "region": "Jezero Crater",
        "data_type": "REAL_SCIENTIFIC_MEASUREMENT",
        "bbox": [jezero["west"], jezero["south"], jezero["east"], jezero["north"]],
        "grid_resolution_deg": round(res_deg, 4),
        "elevation_m": {
            "min": round(float(np.nanmin(subset)), 1),
            "max": round(float(np.nanmax(subset)), 1),
            "mean": round(float(np.nanmean(subset)), 1),
            "std": round(float(np.nanstd(subset)), 1),
        },
        "slope_deg": {
            "min": round(float(np.nanmin(slope)), 2),
            "max": round(float(np.nanmax(slope)), 2),
            "mean": round(float(np.nanmean(slope)), 2),
        },
        "roughness_tri_m": {
            "min": round(float(np.nanmin(tri)), 2),
            "max": round(float(np.nanmax(tri)), 2),
            "mean": round(float(np.nanmean(tri)), 2),
        },
        "sample_rows": len(df),
        "source_citation": "Smith et al. (2001). Mars Orbiter Laser Altimeter. JGR Planets.",
    }
    stats_path = SAMPLES_DIR / "mola_mars_stats.json"
    with open(stats_path, "w", encoding="utf-8") as fh:
        json.dump(stats, fh, indent=2)

    build_data_dictionary(
        [
            {"field_name": "latitude", "description": "Pixel centre latitude", "units": "degrees areographic (north positive)",
             "dtype": "float64", "valid_range": "[-90, 90]", "nodata_value": "NaN", "source": "MOLA MEGaDR"},
            {"field_name": "longitude", "description": "Pixel centre longitude", "units": "degrees areographic (east positive 0-360)",
             "dtype": "float64", "valid_range": "[0, 360]", "nodata_value": "NaN", "source": "MOLA MEGaDR"},
            {"field_name": "elevation_m", "description": "Elevation above Mars areoid (MOLA gravitational datum)",
             "units": "meters", "dtype": "float32", "valid_range": "[-8200, 21500]", "nodata_value": "NaN", "source": "MOLA MEGaDR"},
            {"field_name": "slope_deg", "description": "Terrain slope in degrees (central difference)",
             "units": "degrees", "dtype": "float32", "valid_range": "[0, 90]", "nodata_value": "NaN", "source": "Derived"},
            {"field_name": "roughness_tri_m", "description": "Terrain Ruggedness Index (3x3 kernel)",
             "units": "meters", "dtype": "float32", "valid_range": "[0, 5000]", "nodata_value": "NaN", "source": "Derived"},
            {"field_name": "planet", "description": "Planetary body identifier", "units": "text", "dtype": "str"},
            {"field_name": "datum", "description": "Vertical reference surface (areoid)", "units": "text", "dtype": "str"},
        ],
        SAMPLES_DIR / "mola_mars_data_dictionary.csv",
    )

    write_loading_example(
        dataset_id="mola_megdr", planet="mars",
        csv_path=csv_path, out_path=SAMPLES_DIR / "load_mola_mars.py",
        variable="elevation_m", units="meters",
    )

    return {
        "dataset_id": "mola_megdr",
        "status": "success",
        "files": {
            "csv": str(csv_path),
            "npy": str(npy_path),
            "stats": str(stats_path),
            "dictionary": str(SAMPLES_DIR / "mola_mars_data_dictionary.csv"),
            "loading_example": str(SAMPLES_DIR / "load_mola_mars.py"),
        },
        "sample_rows": len(df),
        "statistics": stats,
    }


# ---------------------------------------------------------------------------
# SRTM GL1 – Earth sample (Real scientific data)
# ---------------------------------------------------------------------------

def build_earth_srtm_sample() -> dict:
    """Build Earth elevation sample from real NASA SRTM 1-arcsec GL1 data."""
    from src.processing.pds_reader import read_hgt_file

    raw_dir = ROOT / "data" / "raw" / "earth" / "srtm_gl1"
    hgt_files = list(raw_dir.glob("*.hgt"))

    if not hgt_files:
        return {"dataset_id": "srtm_gl1", "status": "skipped_missing_input",
                "reason": "Run: python scripts/download_data.py --dataset srtm_gl1"}

    hgt_path = hgt_files[0]
    logger.info("Building real Earth sample from SRTM %s...", hgt_path.name)
    read = read_hgt_file(hgt_path)
    if read["error"]:
        return {"dataset_id": "srtm_gl1", "status": "error", "error": read["error"]}

    arr = read["data"]
    # Downsample by factor of 6 for lightweight sample: 3601x3601 -> 600x600
    stride = 6
    sub_arr = arr[::stride, ::stride]
    res_deg = read["resolution_deg"] * stride

    lat_center = (read["south"] + read["north"]) / 2.0
    px_m, py_m = pixel_size_meters(lat_center, res_deg, "earth")
    slope = compute_slope_degrees(sub_arr, px_m, py_m)
    tri = compute_roughness_tri(sub_arr)

    nsr, nsc = sub_arr.shape
    lons = read["west"] + (np.arange(nsc) + 0.5) * res_deg
    lats = read["north"] - (np.arange(nsr) + 0.5) * res_deg
    lon_grid, lat_grid = np.meshgrid(lons, lats)

    df = pd.DataFrame({
        "latitude": lat_grid.ravel(),
        "longitude": lon_grid.ravel(),
        "elevation_m": sub_arr.ravel(),
        "slope_deg": slope.ravel(),
        "roughness_tri_m": tri.ravel(),
        "planet": "earth",
        "region": "Atacama Desert (Chile)",
        "source": "NASA_SRTM_GL1_30m",
        "datum": "EGM96 geoid / WGS84 ellipsoid",
        "crs": "EPSG:4326 (WGS84)",
        "data_type": "REAL_SCIENTIFIC_MEASUREMENT",
    })

    df = df.dropna(subset=["elevation_m"]).reset_index(drop=True)

    # Sample up to 25,000 rows
    if len(df) > 25_000:
        df_sample = df.sample(25_000, random_state=42).reset_index(drop=True)
    else:
        df_sample = df

    csv_path = SAMPLES_DIR / "srtm_earth_atacama_sample.csv"
    df_sample.to_csv(csv_path, index=False, float_format="%.3f")
    logger.info("Saved: %s (%d rows)", csv_path.name, len(df_sample))

    npy_path = SAMPLES_DIR / "srtm_earth_atacama_elevation.npy"
    np.save(npy_path, sub_arr)
    np.save(SAMPLES_DIR / "srtm_earth_atacama_slope.npy", slope)
    np.save(SAMPLES_DIR / "srtm_earth_atacama_roughness.npy", tri)

    stats = {
        "dataset_id": "srtm_gl1",
        "planet": "earth",
        "tile": hgt_path.stem,
        "region": "Atacama Desert (Chile)",
        "data_type": "REAL_SCIENTIFIC_MEASUREMENT",
        "bbox": [read["west"], read["south"], read["east"], read["north"]],
        "grid_resolution_m": "~180m (downsampled from native 30m)",
        "elevation_m": {
            "min": round(float(np.nanmin(sub_arr)), 1),
            "max": round(float(np.nanmax(sub_arr)), 1),
            "mean": round(float(np.nanmean(sub_arr)), 1),
            "std": round(float(np.nanstd(sub_arr)), 1),
        },
        "slope_deg": {
            "min": round(float(np.nanmin(slope)), 2),
            "max": round(float(np.nanmax(slope)), 2),
            "mean": round(float(np.nanmean(slope)), 2),
        },
        "roughness_tri_m": {
            "min": round(float(np.nanmin(tri)), 2),
            "max": round(float(np.nanmax(tri)), 2),
            "mean": round(float(np.nanmean(tri)), 2),
        },
        "sample_rows": len(df_sample),
        "source_citation": "Farr et al. (2007). The Shuttle Radar Topography Mission. Reviews of Geophysics.",
    }
    stats_path = SAMPLES_DIR / "srtm_earth_stats.json"
    with open(stats_path, "w", encoding="utf-8") as fh:
        json.dump(stats, fh, indent=2)

    build_data_dictionary(
        [
            {"field_name": "latitude", "description": "Pixel centre latitude", "units": "degrees north (WGS84)",
             "dtype": "float64", "valid_range": "[-24, -23]", "nodata_value": "NaN", "source": "NASA SRTM GL1"},
            {"field_name": "longitude", "description": "Pixel centre longitude", "units": "degrees east (WGS84)",
             "dtype": "float64", "valid_range": "[-69, -68]", "nodata_value": "NaN", "source": "NASA SRTM GL1"},
            {"field_name": "elevation_m", "description": "Terrain elevation above EGM96 geoid",
             "units": "meters", "dtype": "float32", "valid_range": "[0, 9000]", "nodata_value": "NaN", "source": "NASA SRTM GL1"},
            {"field_name": "slope_deg", "description": "Terrain slope in degrees (central difference)",
             "units": "degrees", "dtype": "float32", "valid_range": "[0, 90]", "nodata_value": "NaN", "source": "Derived"},
            {"field_name": "roughness_tri_m", "description": "Terrain Ruggedness Index (3x3 kernel)",
             "units": "meters", "dtype": "float32", "valid_range": "[0, 5000]", "nodata_value": "NaN", "source": "Derived"},
            {"field_name": "planet", "description": "Planetary body identifier (earth)", "units": "text", "dtype": "str"},
            {"field_name": "datum", "description": "Vertical reference datum (EGM96 geoid)", "units": "text", "dtype": "str"},
        ],
        SAMPLES_DIR / "srtm_earth_data_dictionary.csv",
    )

    write_loading_example(
        dataset_id="srtm_gl1", planet="earth",
        csv_path=csv_path, out_path=SAMPLES_DIR / "load_srtm_earth.py",
        variable="elevation_m", units="meters",
    )

    return {
        "dataset_id": "srtm_gl1",
        "status": "success",
        "files": {
            "csv": str(csv_path),
            "npy": str(npy_path),
            "stats": str(stats_path),
            "dictionary": str(SAMPLES_DIR / "srtm_earth_data_dictionary.csv"),
            "loading_example": str(SAMPLES_DIR / "load_srtm_earth.py"),
        },
        "sample_rows": len(df_sample),
        "statistics": stats,
    }



# ---------------------------------------------------------------------------
# Synthetic Earth analogue sample (documented as synthetic)
# ---------------------------------------------------------------------------

def build_earth_analogue_synthetic() -> dict:
    """
    Build a CLEARLY LABELLED synthetic Earth analogue sample.

    This is NOT real data. It demonstrates the expected schema for an Earth
    dataset (e.g., SRTM elevation + MODIS LST) so teammates can begin
    pipeline development before credentials are available.

    The file header and data_source field explicitly identify this as synthetic.
    """
    logger.info("Building SYNTHETIC Earth analogue sample (labelled clearly)...")

    np.random.seed(42)
    n = 2_000

    # Atacama Desert-like terrain: ~2500 m elevation, low-slope desert
    elevation = np.random.normal(2500, 400, n).clip(1800, 4500)
    slope = np.abs(np.random.normal(3, 2, n)).clip(0, 45)
    lst_day_k = np.random.normal(305, 8, n).clip(275, 340)    # Kelvin
    lst_night_k = np.random.normal(268, 5, n).clip(250, 285)  # Kelvin
    lat = np.random.uniform(-24.5, -22.0, n)
    lon = np.random.uniform(-70.0, -68.0, n)

    df = pd.DataFrame({
        "latitude": lat,
        "longitude": lon,
        "elevation_m": elevation.round(1),
        "slope_deg": slope.round(2),
        "lst_day_kelvin": lst_day_k.round(1),
        "lst_night_kelvin": lst_night_k.round(1),
        "land_cover_igbp": np.random.choice([16, 17], n, p=[0.3, 0.7]),  # 16=barren, 17=water bodies (illustrative)
        "planet": "earth",
        "region": "Atacama Desert (Chile)",
        "data_source": "SYNTHETIC – NOT REAL DATA. Replace with SRTM+MODIS once credentials available.",
        "crs": "WGS84 EPSG:4326",
    })

    csv_path = SAMPLES_DIR / "SYNTHETIC_earth_atacama_analogue_sample.csv"
    df.to_csv(csv_path, index=False, float_format="%.4f")
    logger.info("Saved: %s (SYNTHETIC)", csv_path.name)

    # Explicit README alongside the file
    readme = SAMPLES_DIR / "SYNTHETIC_earth_atacama_README.txt"
    with open(readme, "w", encoding="utf-8") as fh:
        fh.write("""SYNTHETIC EARTH ANALOGUE DATASET – NOT REAL DATA
==================================================
This file was generated by build_samples.py to provide a schema placeholder
for the Earth (Atacama Desert) dataset while NASA Earthdata credentials are
being set up.

DO NOT use this file for any scientific conclusions.

To replace with real data:
1. Register at https://urs.earthdata.nasa.gov/
2. Copy .env.example to .env and fill in credentials
3. Re-run: python scripts/download_data.py
4. Re-run: python scripts/build_samples.py

Real data sources:
  - SRTM GL1 (elevation): https://lpdaac.usgs.gov/products/srtmgl1v003/
  - MODIS MOD11A2 (LST):   https://lpdaac.usgs.gov/products/mod11a2v061/
  - MODIS MCD12Q1 (land cover): https://lpdaac.usgs.gov/products/mcd12q1v061/
""")

    build_data_dictionary(
        [
            {"field_name": "latitude", "description": "Point latitude (WGS84)", "units": "degrees north", "dtype": "float64"},
            {"field_name": "longitude", "description": "Point longitude (WGS84)", "units": "degrees east", "dtype": "float64"},
            {"field_name": "elevation_m", "description": "[SYNTHETIC] Terrain elevation above WGS84 ellipsoid",
             "units": "meters", "dtype": "float64", "valid_range": "[-500, 9000]",
             "notes": "Real data: SRTM GL1, ~30m resolution"},
            {"field_name": "slope_deg", "description": "[SYNTHETIC] Terrain slope", "units": "degrees", "dtype": "float64"},
            {"field_name": "lst_day_kelvin", "description": "[SYNTHETIC] Daytime land surface temperature",
             "units": "Kelvin", "dtype": "float64",
             "notes": "Real data: MODIS MOD11A2, 8-day composite, 1 km resolution. Apply scale=0.02."},
            {"field_name": "lst_night_kelvin", "description": "[SYNTHETIC] Nighttime land surface temperature",
             "units": "Kelvin", "dtype": "float64"},
            {"field_name": "land_cover_igbp", "description": "[SYNTHETIC] IGBP land cover class (16=Barren, 17=Water Bodies)",
             "units": "integer class", "dtype": "int",
             "notes": "Real data: MODIS MCD12Q1. See IGBP legend in data_dictionary.md"},
            {"field_name": "data_source", "description": "Origin of data – SYNTHETIC in this file",
             "units": "text", "dtype": "str"},
        ],
        SAMPLES_DIR / "SYNTHETIC_earth_atacama_data_dictionary.csv",
    )

    return {
        "dataset_id": "earth_atacama_SYNTHETIC",
        "status": "success_synthetic",
        "warning": "THIS IS SYNTHETIC DATA – NOT REAL SCIENTIFIC MEASUREMENTS",
        "files": {"csv": str(csv_path), "readme": str(readme)},
        "sample_rows": n,
    }


# ---------------------------------------------------------------------------
# Cross-planetary schema proposal
# ---------------------------------------------------------------------------

def build_cross_planetary_schema() -> dict:
    """
    Write a proposed schema for future cross-planetary comparison.
    Does NOT combine real measurements – only documents the proposed structure.
    """
    schema = {
        "_note": (
            "PROPOSED SCHEMA ONLY – not a real combined dataset. "
            "Each planetary body uses different datums, measurement methods, and instruments. "
            "Direct numerical comparison without careful normalisation is not scientifically valid."
        ),
        "proposed_fields": [
            {"field": "planet", "description": "earth / mars / moon", "units": "text"},
            {"field": "region_name", "description": "Named region identifier", "units": "text"},
            {"field": "latitude", "description": "Centre latitude in body-fixed coordinate", "units": "degrees"},
            {"field": "longitude", "description": "Centre longitude in body-fixed coordinate", "units": "degrees"},
            {"field": "elevation_m", "description": "Elevation above body datum", "units": "meters",
             "caution": "Different datums: WGS84 (Earth), areoid (Mars), lunar mean radius (Moon)"},
            {"field": "slope_deg", "description": "Terrain slope (comparable across bodies)", "units": "degrees",
             "caution": "Resolution differences affect measured slope values"},
            {"field": "roughness_tri", "description": "Terrain Ruggedness Index (TRI)", "units": "meters",
             "caution": "Window size and resolution affect comparability"},
            {"field": "lst_kelvin", "description": "Surface temperature", "units": "Kelvin",
             "caution": "Very different measurement methods: MODIS IR (Earth) vs TES/MCS (Mars) vs Diviner (Moon). NOT directly comparable."},
            {"field": "source_dataset", "description": "Source dataset ID", "units": "text"},
            {"field": "data_type", "description": "measured / derived / synthetic", "units": "text"},
        ],
        "comparability_matrix": {
            "elevation_m": "NOT directly comparable (different datums) – useful for relative terrain analysis only",
            "slope_deg": "COMPARABLE if spatial resolution differences are accounted for",
            "roughness_tri": "COMPARABLE within same resolution class",
            "lst_kelvin": "NOT directly comparable – different sensor physics and atmospheric effects",
            "land_cover": "Earth-only concept – no direct analogue on Mars/Moon",
        },
    }

    schema_path = SAMPLES_DIR / "proposed_cross_planetary_schema.json"
    with open(schema_path, "w", encoding="utf-8") as fh:
        json.dump(schema, fh, indent=2)

    return {"status": "success", "file": str(schema_path)}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

BUILDERS = {
    "lola_64ppd": build_lola_sample,
    "mola_meg128": build_mola_sample,
    "earth_srtm": build_earth_srtm_sample,
    "cross_planetary_schema": build_cross_planetary_schema,
    "earth_synthetic": build_earth_analogue_synthetic,
}


def main(args: argparse.Namespace) -> dict:
    results = []

    for name, fn in BUILDERS.items():
        if args.dataset and name != args.dataset:
            continue
        logger.info("Building sample: %s", name)
        r = fn()
        results.append(r)

    # Write samples manifest
    manifest = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "samples_dir": str(SAMPLES_DIR),
        "results": results,
    }
    manifest_path = SAMPLES_DIR / "samples_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)

    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build sample datasets")
    parser.add_argument("--dataset", default=None, help="Build only this sample")
    args = parser.parse_args()

    manifest = main(args)

    print("\n" + "=" * 60)
    print("SAMPLE BUILD REPORT")
    print("=" * 60)
    for r in manifest["results"]:
        ds_id = r.get("dataset_id", r.get("status", "?"))
        status = r.get("status", "?")
        rows = r.get("sample_rows", "")
        icon = "✓" if "success" in status else ("↷" if "skip" in status else "✗")
        print(f"  {icon} {ds_id:35s} → {status}  rows={rows}")
    print("=" * 60)
    print(f"Samples dir: {SAMPLES_DIR}")
    print(f"Manifest:    {SAMPLES_DIR / 'samples_manifest.json'}")
