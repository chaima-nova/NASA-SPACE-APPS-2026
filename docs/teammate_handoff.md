# Teammate Handoff Guide

**Target Audience:** Harshil (Comparison Engine), Zehra (Scientific Criteria), Presentation Team  
**Prepared by:** Abid T S (Data Engineering & Processing Lead)  
**Date:** November 2026  
**Pipeline Root:** `f:/Sem5/nasa`

---

## 1. Welcome & Data Engineering Overview

The data engineering pipeline for our Space Apps challenge project is built, verified, and aligned with Zehra's **TERRANEXUS** framework.

You do **not** need to scrape external repositories or manually parse binary labels. Cleaned, scientifically validated tabular and raster datasets are ready for downstream analysis in `data/samples/`.

---

## 2. Ready-to-Use Datasets & Rasters

All sample files are stored in `data/samples/` and are packaged with lightweight schemas for immediate use in pandas, NumPy, GeoPandas, or web visualization libraries.

| Dataset / File | Body | Resolution | Rows / Shape | Key Parameters | Scientific Role |
|---|---|---|---|---|---|
| `srtm_earth_atacama_sample.csv`<br>`srtm_earth_atacama_elevation.npy` | **Earth** | ~180 m (downsampled from native 30 m) | 25,000 rows<br>(600 × 600 grid) | `latitude`, `longitude`, `elevation_m`, `slope_deg`, `roughness_tri_m` | **Real scientific data** from NASA SRTM tile S24W069 (Atacama Desert, Chile). Gold-standard terrestrial analogue terrain. |
| `lola_moon_south_pole_sample.csv`<br>`lola_moon_south_pole_elevation.npy` | **Moon** | 4 pixels/degree (~7.58 km at equator) | 14,400 rows<br>(40 × 360 grid) | `latitude`, `longitude`, `elevation_m`, `slope_deg`, `roughness_tri_m` | **Real scientific data** from LOLA GDRDEM (`LDEM_4`). Polar band 80°S–90°S. Slope calculated with row-varying longitudinal width. |
| `mola_mars_jezero_sample.csv`<br>`mola_mars_jezero_elevation.npy` | **Mars** | 4 pixels/degree (~14.8 km at equator) | 100 rows<br>(10 × 10 grid) | `latitude`, `longitude`, `elevation_m`, `slope_deg`, `roughness_tri_m` | **Real scientific data** from MOLA MEGaDR (`megt90n000cb`). Jezero Crater ROI (17°N–20°N, 76°E–79°E). |
| `proposed_cross_planetary_schema.json` | **All** | Schema specification | — | Schema fields, units, and comparability matrix | Master schema defining acceptable comparisons and datum warnings. |

> [!NOTE]
> **Full 2D Raster Grids (`.npy`)**: For windowed relief, slope, and roughness computations, use the `.npy` files (`*_elevation.npy`, `*_slope.npy`, `*_roughness.npy`) rather than sampled tabular CSVs.

---

## 3. Python Quickstart: Loading and Analyzing Grids

### 3.1 Loading Real Earth SRTM Elevation & Slope
```python
import numpy as np
import pandas as pd

# 1. Tabular sample
df_earth = pd.read_csv("data/samples/srtm_earth_atacama_sample.csv")
print("Earth SRTM shape:", df_earth.shape)
print(df_earth[["elevation_m", "slope_deg", "roughness_tri_m"]].describe())

# 2. Full 2D elevation matrix for windowed analysis
grid_earth = np.load("data/samples/srtm_earth_atacama_elevation.npy")
print("Earth 2D raster shape:", grid_earth.shape)
```

### 3.2 Loading Lunar South Pole & Mars Jezero Rasters
```python
import numpy as np

# Load 2D rasters for Moon and Mars
moon_elev = np.load("data/samples/lola_moon_south_pole_elevation.npy")
moon_slope = np.load("data/samples/lola_moon_south_pole_slope.npy")
mars_elev = np.load("data/samples/mola_mars_jezero_elevation.npy")

print(f"Moon South Pole elevation range: [{np.nanmin(moon_elev):.1f}, {np.nanmax(moon_elev):.1f}] m")
print(f"Mars Jezero Crater elevation range: [{np.nanmin(mars_elev):.1f}, {np.nanmax(mars_elev):.1f}] m")
```

### 3.3 Computing Windowed Local Relief (Correct Method)
```python
import numpy as np

def compute_windowed_relief(grid: np.ndarray, window_size: int = 5) -> np.ndarray:
    """Compute local relief (max - min) in sliding metric windows."""
    from scipy.ndimage import generic_filter
    def _relief(values):
        valid = values[~np.isnan(values)]
        return float(np.max(valid) - np.min(valid)) if len(valid) > 0 else np.nan
    return generic_filter(grid, _relief, size=window_size)

earth_relief = compute_windowed_relief(grid_earth, window_size=5)
print(f"Mean local relief in Atacama: {np.nanmean(earth_relief):.1f} m")
```

---

## 4. Engine Comparison Directives (Zehra's Framework)

Harshil’s comparison engine must strictly adhere to the following 4 scientific rules:

1. **Four Result States Only (No Invented Combined Scores)**:
   * Every parameter comparison must evaluate to:
     * `SIMILAR` (Distributions overlap at matched baseline)
     * `DIFFERENT (mismatch)` (Distributions do not overlap)
     * `INSUFFICIENT EVIDENCE` (Quality/coverage inadequate or pending ingestion)
     * `NOT COMPARABLE` (Physically incompatible definitions, e.g. absolute elevation)
2. **Never Compare Absolute Elevation**:
   * Earth: Mean sea level (EGM96 geoid).
   * Mars: Gravitational equipotential areoid.
   * Moon: $1,737.4\text{ km}$ reference sphere.
   * *Mark absolute elevation as `NOT COMPARABLE`.* Compare **local relief** ($\Delta h = h_{\max} - h_{\min}$ within a fixed metric window), **slope distributions**, and **roughness**.
3. **Resample to a Common Metric Baseline**:
   * Do not compare raw $30\text{ m}$ SRTM slopes directly against coarse global planetary grids ($\approx 7.6\text{ km}$ Moon, $\approx 14.8\text{ km}$ Mars). Resample/downsample grids to a shared horizontal metric baseline before computing slope histograms.
4. **Thermal / Temperature Restriction**:
   * ASU THEMIS Day IR tiles are 8-bit PNG images (non-numeric pictures).
   * Awaiting TES thermal inertia binary (`nmap2003.bin`) and Diviner Level 2/3 ingestion.
   * *Output `INSUFFICIENT EVIDENCE` for Mars and Moon thermal parameters.*

---

## 5. Pre-Built Loading Scripts

Automated Python loaders are provided in `data/samples/`:
```bash
python data/samples/load_srtm_earth.py
python data/samples/load_lola_moon.py
python data/samples/load_mola_mars.py
```
