# Quick & Simple Guide: What Was Fixed in Our NASA Data

**Author:** Abid T S (Data Lead)  
**Date:** November 2026  
**Status:** All issues resolved & pushed to GitHub `main`

---

## 1. The Big Picture (What Is Our Job?)
Our job on the team is **Data Engineering**:
1. Take raw satellite files from NASA (Moon, Mars, and Earth).
2. Clean them, fix any errors, and calculate terrain steepness (slope) and roughness.
3. Hand clean files over to **Harshil** (who builds the comparison engine) and **Jaz** (who builds the 3D visual app).

---

## 2. What Problems Did Harshil Find? (In Plain English)

| Problem | What Was Wrong? | Why It Mattered |
|---|---|---|
| **1. Earth Data Was Fake** | We had a real NASA satellite file on disk, but our code accidentally ran a placeholder script that generated random fake numbers. | Teammates couldn't do real science on fake numbers. |
| **2. Resolution Confusion** | The docs claimed our data was sharp (463 meters per pixel), but the files we downloaded were actually coarse (7.5 km to 15 km per pixel). | Jezero Crater on Mars is only 45 km wide, so on a 15 km grid it is only 10 pixels across. |
| **3. Polar Slope Glitch** | Near the Moon's South Pole, lines of longitude get very close together (down to 16 meters). Our math treated them as 660 meters wide everywhere. | Slope values near the pole were distorted. |
| **4. Fake Cliff Glitch** | When calculating slopes, empty/missing pixels were replaced with `0`. | A 2,500m mountain next to an empty pixel looked like a massive 90° vertical drop. |
| **5. Missing 2D Map Grids** | We only gave CSV tables with random points, not full 2D map grids. | You cannot calculate local mountain relief or surface roughness without the full 2D grid. |
| **6. Missing Mars Temperature Reader** | We had no code to read the real scientific Mars thermal inertia file (`nmap2003.bin`). | Harshil couldn't use Mars temperature data. |

---

## 3. How We Fixed Everything

### ✅ Fix 1: Real NASA Earth Data Is Now Active
* We switched the pipeline to read the real NASA SRTM satellite tile (`S24W069.hgt`).
* We created **`srtm_earth_atacama_sample.csv`** containing **25,000 real elevation measurements** from the Atacama Desert in Chile.
* The fake dataset is quarantined so nobody uses it by mistake.

### ✅ Fix 2: Fixed the South Pole Math
* The code in `src/processing/terrain.py` now calculates longitude spacing row-by-row. 
* As you get closer to the South Pole, it accurately shrinks the pixel width from 1,300 meters down to 16 meters.

### ✅ Fix 3: Eliminated Fake Cliffs
* Any pixel next to an empty or missing value is now safely ignored instead of being filled with zero. No more fake 90° cliffs!

### ✅ Fix 4: Full 2D Map Grids Saved (`.npy` files)
Harshil now has full 2D raster grids saved for all three bodies:
* **Moon:** `lola_moon_south_pole_elevation.npy`, `*_slope.npy`, `*_roughness.npy`
* **Mars:** `mola_mars_jezero_elevation.npy`, `*_slope.npy`, `*_roughness.npy`
* **Earth:** `srtm_earth_atacama_elevation.npy`, `*_slope.npy`, `*_roughness.npy`

### ✅ Fix 5: Created Mars Thermal Inertia Reader
* Added a new Python function (`read_tes_thermal_inertia`) that reads the scientific big-endian binary file and applies the NASA mask so only real satellite measurements are used.

### ✅ Fix 6: Honest & Accurate Documentation
* All docs, catalogs, and handoffs now truthfully state our current resolution is **4 pixels/degree** (~7.5 km Moon, ~14.8 km Mars), and describe the exact path to high-res quadrants.
* Removed unscientific guesses like *"slope < 5° means safe landing"*.

---

## 4. Where Is the Data Right Now?

All the files are in the folder:  
📂 **`data/samples/`**

```text
data/samples/
├── srtm_earth_atacama_sample.csv       <-- Real Earth measurements (25,000 rows)
├── srtm_earth_atacama_elevation.npy     <-- Real Earth 2D elevation grid
├── srtm_earth_atacama_slope.npy         <-- Real Earth 2D slope grid
├── srtm_earth_atacama_roughness.npy     <-- Real Earth 2D roughness grid
├── lola_moon_south_pole_sample.csv      <-- Real Moon measurements (14,400 rows)
├── lola_moon_south_pole_elevation.npy   <-- Real Moon 2D elevation grid
├── lola_moon_south_pole_slope.npy       <-- Real Moon 2D slope grid (fixed math)
├── lola_moon_south_pole_roughness.npy   <-- Real Moon 2D roughness grid
├── mola_mars_jezero_sample.csv          <-- Real Mars Jezero measurements
├── mola_mars_jezero_elevation.npy       <-- Real Mars 2D elevation grid
├── mola_mars_jezero_slope.npy           <-- Real Mars 2D slope grid
├── mola_mars_jezero_roughness.npy       <-- Real Mars 2D roughness grid
├── load_srtm_earth.py                   <-- Quick Python loader for Earth
├── load_lola_moon.py                    <-- Quick Python loader for Moon
└── load_mola_mars.py                    <-- Quick Python loader for Mars
```

---

## 5. How Harshil Can Load the Data in 3 Lines

```python
import numpy as np
import pandas as pd

# Load real Earth tabular sample
df_earth = pd.read_csv("data/samples/srtm_earth_atacama_sample.csv")

# Load real 2D elevation grids for analysis
moon_grid = np.load("data/samples/lola_moon_south_pole_elevation.npy")
mars_grid = np.load("data/samples/mola_mars_jezero_elevation.npy")
earth_grid = np.load("data/samples/srtm_earth_atacama_elevation.npy")
```

---

## 6. What Should the Team Know?
1. **Everything is pushed to GitHub `main`:** Just tell your teammates to run `git pull`.
2. **All 58 unit tests pass:** The code has been checked and verified (`pytest` 100% green).
3. **Your data engineering work is complete:** Harshil has all the clean data and 2D grids he asked for!
