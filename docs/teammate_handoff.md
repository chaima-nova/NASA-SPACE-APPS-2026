# Teammate Handoff Guide

**Target Audience:** Farwa, Harshil, and the NASA Space Apps Challenge Project Team  
**Prepared by:** NASA Data / Platform Lead  
**Date:** October 2024  
**Pipeline Root:** `f:/Sem5/nasa`

---

## 1. Welcome & Immediate Action Items

Hi Farwa and Harshil! 👋

The core data engineering pipeline for our Space Apps challenge project is built, verified, and automated. 

You do **not** need to scrape NASA websites or manually download multi-gigabyte binary files. Cleaned, scientifically validated, and standardized sample datasets are available right now in `data/samples/`.

---

## 2. Ready-to-Use Sample Datasets

All sample files are stored in `data/samples/` and are packaged with lightweight schemas for immediate use in pandas, geopandas, NumPy, or web visualization libraries.

| Sample File | Planetary Body | Key Parameters | Size | Best For |
|---|---|---|---|---|
| `lola_64ppd_moon_south_pole_sample.csv` | **Moon** | `latitude`, `longitude`, `elevation_m`, `slope_deg` | ~2.5 MB | South Pole Artemis landing sites, Shackleton rim analysis, slope traversability |
| `mola_128ppd_mars_jezero_sample.csv` | **Mars** | `latitude`, `longitude`, `elevation_m`, `slope_deg` | ~2.1 MB | Jezero Crater Perseverance terrain, delta slope, crater rim relief |
| `SYNTHETIC_earth_atacama_analogue_sample.csv` | **Earth (Analogue)** | `latitude`, `longitude`, `elevation_m`, `slope_deg`, `lst_day_kelvin`, `qa_flag` | ~1.8 MB | Testing analogue scoring algorithms while Earthdata credentials are confirmed |
| `data_dictionary.csv` | **All** | Master field catalog, units, datatypes, valid bounds | ~20 KB | Automated schema reference for UI tables or data loaders |

---

## 3. How to Load and Explore the Data (Python Quickstart)

Here are ready-to-copy code snippets you can run in a Jupyter Notebook, Python script, or backend service:

### 3.1 Loading Lunar South Pole Elevation & Slope
```python
import pandas as pd
import numpy as np

# Load lunar south pole sample
df_moon = pd.read_csv("data/samples/lola_64ppd_moon_south_pole_sample.csv")

print("Moon Sample Shape:", df_moon.shape)
print(df_moon.head())

# Filter for flat terrain suitable for landing (slope < 5 degrees)
safe_landing_zones = df_moon[df_moon["slope_deg"] < 5.0]
print(f"Safe landing points found: {len(safe_landing_zones)} / {len(df_moon)}")

# Summary statistics for elevation and slope
print(df_moon[["elevation_m", "slope_deg"]].describe())
```

### 3.2 Loading Mars Jezero Crater Topography
```python
import pandas as pd

# Load Jezero Crater terrain
df_mars = pd.read_csv("data/samples/mola_128ppd_mars_jezero_sample.csv")

# Find lowest point in the crater basin (potential lakebed sediments)
lowest_point = df_mars.loc[df_mars["elevation_m"].idxmin()]
highest_point = df_mars.loc[df_mars["elevation_m"].idxmax()]

print(f"Jezero Min Elevation: {lowest_point['elevation_m']:.1f} m at ({lowest_point['latitude']:.2f}, {lowest_point['longitude']:.2f})")
print(f"Jezero Max Elevation: {highest_point['elevation_m']:.1f} m at ({highest_point['latitude']:.2f}, {highest_point['longitude']:.2f})")
print(f"Crater Relief: {highest_point['elevation_m'] - lowest_point['elevation_m']:.1f} m")
```

### 3.3 Loading with Pre-Built Loading Scripts
For each sample, an automated loader script is located in `data/samples/`:
```bash
python data/samples/load_lola_64ppd_moon.py
python data/samples/load_mola_128ppd_mars.py
```

---

## 4. Task Mapping: Which Dataset Should You Use?

- **Harshil (Geospatial Analysis / 3D Visualization / Mapping):**
  - Use `elevation_m` and `slope_deg` from `lola_64ppd_moon_south_pole_sample.csv` and `mola_128ppd_mars_jezero_sample.csv`.
  - Grid data into 2D heatmaps or 3D mesh surfaces using `latitude` and `longitude`.
  - For Moon coordinates: remember selenographic coordinates are centered on lunar center-of-mass with $R = 1737.4\text{ km}$.
- **Farwa (Machine Learning / Analogue Scoring / Feature Engineering):**
  - Normalize features relative to regional scales rather than absolute values.
  - Calculate relative relief ($\text{elevation} - \text{mean\_elevation}$) and roughness distributions.
  - Use `qa_flag == 0` to filter only high-confidence observations.

---

## 5. Critical Scientific Guidelines (What NOT to do!)

> [!WARNING]
> 1. **Do NOT subtract Earth elevation from Mars or Moon elevation directly.**  
>    Earth elevation is relative to mean sea level (geoid). Mars elevation is relative to a gravitational equipotential areoid. Lunar elevation is relative to a fixed sphere ($1737.4\text{ km}$). Comparing absolute numbers is scientifically meaningless.
> 2. **Do NOT assume similar terrain means biological habitability.**  
>    An Earth desert site with matching slope and roughness still has $1000\times$ more atmospheric pressure, liquid water cycle, and zero deadly cosmic radiation. State clearly that analogues are geological/operational proxies.
> 3. **Watch the resolution scale:**  
>    Moon data is ~472 m/pixel; Mars data is ~463 m/pixel; Earth SRTM is ~30 m/pixel. Slope values measured over 30 m will naturally show higher extremes than slope smoothed over 472 m.

---

## 6. How to Regenerate or Expand the Data

### Running the Full Pipeline
To rerun all stages (discovery, download, inspection, cleaning, validation, sample building):
```bash
python scripts/run_pipeline.py
```

### Running Individual Stages
```bash
# 1. Discover reachable datasets:
python scripts/discover_datasets.py

# 2. Download raw datasets:
python scripts/download_data.py

# 3. Clean and normalize data:
python scripts/clean_data.py

# 4. Run automated validation checks:
python scripts/validate_data.py

# 5. Build fresh sample CSVs:
python scripts/build_samples.py
```

### Running Automated Test Suite
```bash
python -m pytest tests/ -v
```

---

## 7. Requesting Additional Datasets

Once our team's three final challenge focus areas are confirmed, we can easily add new datasets:
1. Open `config/datasets.json`.
2. Add a new JSON object under `"datasets"` with:
   - `id`: unique machine identifier
   - `name`: descriptive name
   - `planetary_body`: `"earth"`, `"mars"`, `"moon"`, etc.
   - `download_url`: direct HTTP/PDS/API endpoint
   - `access_method`: `"http_direct"`, `"pds_geosciences"`, or `"earthdata_login"`
3. If Earthdata credentials are required, create a `.env` file (copied from `.env.example`):
   ```env
   NASA_EARTHDATA_USERNAME=your_username
   NASA_EARTHDATA_PASSWORD=your_password
   NASA_API_KEY=your_nasa_api_key
   ```
4. Ping me and I will configure the custom parser and update the pipeline!
