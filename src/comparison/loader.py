"""
src/comparison/loader.py
Load validated on-disk data products into plain numpy arrays and dicts.
Raises clear errors if files are missing or unreadable.
"""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SAMPLES_DIR = Path(__file__).parents[2] / "data" / "samples"
CONFIG_DIR  = Path(__file__).parents[2] / "config"


# ---------------------------------------------------------------------------
# .npy loader
# ---------------------------------------------------------------------------

def load_npy(path: str | Path) -> np.ndarray:
    """Load a .npy raster; replace any fill-value sentinels with NaN."""
    arr = np.load(str(path)).astype(np.float32)
    # Common nodata sentinels used by the pipeline
    for sentinel in (-9999.0, -32768.0, 32767.0):
        arr[arr == sentinel] = np.nan
    return arr


# ---------------------------------------------------------------------------
# Stats JSON loader
# ---------------------------------------------------------------------------

def load_stats_json(path: str | Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Geology crosswalk loader
# ---------------------------------------------------------------------------

def load_crosswalk() -> dict:
    path = CONFIG_DIR / "geology_crosswalk.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Named dataset bundles
# ---------------------------------------------------------------------------

class PlanetaryDataset:
    """Container for one body's pre-validated arrays and metadata."""

    def __init__(
        self,
        body: str,
        region_id: str,
        elevation: np.ndarray,
        slope: np.ndarray,
        roughness: np.ndarray,
        stats: dict,
        resolution_m: float,
    ):
        self.body        = body
        self.region_id   = region_id
        self.elevation   = elevation
        self.slope       = slope
        self.roughness   = roughness
        self.stats       = stats
        self.resolution_m = resolution_m

    @property
    def shape(self) -> tuple:
        return self.elevation.shape

    @property
    def n_valid_elevation(self) -> int:
        return int(np.sum(~np.isnan(self.elevation)))


def load_earth_atacama() -> PlanetaryDataset:
    return PlanetaryDataset(
        body="earth",
        region_id="earth_atacama_s24w069",
        elevation = load_npy(SAMPLES_DIR / "srtm_earth_atacama_elevation.npy"),
        slope     = load_npy(SAMPLES_DIR / "srtm_earth_atacama_slope.npy"),
        roughness = load_npy(SAMPLES_DIR / "srtm_earth_atacama_roughness.npy"),
        stats     = load_stats_json(SAMPLES_DIR / "srtm_earth_stats.json"),
        resolution_m=180.0,
    )


def load_moon_south_pole() -> PlanetaryDataset:
    return PlanetaryDataset(
        body="moon",
        region_id="moon_south_pole_lola",
        elevation = load_npy(SAMPLES_DIR / "lola_moon_south_pole_elevation.npy"),
        slope     = load_npy(SAMPLES_DIR / "lola_moon_south_pole_slope.npy"),
        roughness = load_npy(SAMPLES_DIR / "lola_moon_south_pole_roughness.npy"),
        stats     = load_stats_json(SAMPLES_DIR / "lola_moon_stats.json"),
        resolution_m=7580.0,
    )


def load_mars_jezero() -> PlanetaryDataset:
    return PlanetaryDataset(
        body="mars",
        region_id="mars_jezero_mola",
        elevation = load_npy(SAMPLES_DIR / "mola_mars_jezero_elevation.npy"),
        slope     = load_npy(SAMPLES_DIR / "mola_mars_jezero_slope.npy"),
        roughness = load_npy(SAMPLES_DIR / "mola_mars_jezero_roughness.npy"),
        stats     = load_stats_json(SAMPLES_DIR / "mola_mars_stats.json"),
        resolution_m=14800.0,
    )
