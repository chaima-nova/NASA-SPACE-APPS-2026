# DATA VALIDATION & PIPELINE READINESS REPORT (v2.0)
**Workstream:** Data Ingestion, Processing & Validation (Abid T S)  
**Recipients:** Harshil (Comparison Engine Implementation), Zehra (Scientific Criteria), Team Lead  
**Date:** 14 November 2026  
**Status:** Comprehensive Review & Technical Remediation Complete  
**Reference Framework:** TERRANEXUS (Zehra, 13 Nov 2026) & Harshil's Review (14 Nov 2026)

---

## 1. Executive Summary & Action Summary

Following Harshil’s detailed review of the pipeline and data products, all identified technical blockers and discrepancies have been resolved. Real Earth SRTM data is now generated, latitude-dependent polar pixel scaling is corrected, NaN boundary cliffing is masked, a TES thermal inertia reader is implemented, full 2D grids (`.npy`) for elevation, slope, and roughness are saved, and resolution metrics are transparently documented.

| Dataset / Product | Dimension | Native Resolution | Spatial Coverage | Verified Value Range | Status for Engine | Key Caveat / Handling Directive |
|---|---|---|---|---|---|---|
| **NASA SRTM GL1 (`S24W069.hgt`)** | Earth Topography | 1 arc-second (~30 m at equator) | Atacama tile S24W069 (24°S–23°S, 69°W–68°W) | [2,201.0 m, 4,282.0 m] (100% valid, 0 voids) | ✅ **READY TO USE (REAL)** | Real NASA measurement. Sample downsampled to ~180m; resample to match planetary baselines. Vertical datum: EGM96 Geoid. |
| **LOLA GDR (`ldem_4.img`)** | Moon Topography | 4 pixels/degree (~7.58 km/pixel) | Global (80°S–90°S South Pole extracted) | [-8,878.5 m, +10,504.0 m] (Global); [-4,100.5 m, +6,846.0 m] (Pole) | ✅ **READY TO USE (REGIONAL)** | Real altimetry. Scaling factor = 0.5, offset = 1,737,400.0 m. Row-varying pixel width applied. Coarse baseline only. |
| **MOLA MEGDR (`megt90n000cb.img`)** | Mars Topography | 4 pixels/degree (~14.8 km/pixel) | Global (17°N–20°N, 76°E–79°E Jezero extracted) | [-8,068.0 m, +21,134.0 m] (Global); [-3,723.0 m, -364.0 m] (Jezero) | ✅ **READY TO USE (REGIONAL)** | Real altimetry. MSB 16-bit integer, scale = 1.0, offset = 0.0 m relative to areoid. 10×10 Jezero cells. Coarse baseline only. |
| **MGS TES Thermal Inertia (`nmap2003.bin`)** | Mars Thermal | 20 pixels/degree (~3.0 km/pixel) | Global (60% valid between 80°S and 80°N) | 5 to 5,000 J m^-2 K^-1 s^-1/2 (tiu) | ⏳ **READER READY** | Dedicated binary parser implemented (`read_tes_thermal_inertia`). Must apply interpolation mask (1 = real data). |
| **Diviner GDR Level 2 / Level 3** | Moon Thermal & Rock | 32 to 128 pixels/degree (~230 m to 1 km) | 60°S to 60°N (Rock Abundance); Global/Polar (L2 TB) | 10 to 450 K (TB); 0 to 1 (Rock Abundance) | ⏳ **PENDING INGESTION** | Download pending. Must be labelled "not yet ingested" rather than scientifically insufficient. Outside 60°: INSUFFICIENT EVIDENCE. |
| **ASU THEMIS Day IR Global Mosaic** | Mars Thermal | 256 pixels/degree (~231.5 m/pixel) | Global 30°×30° tiles | 8-bit PNG images (0–255 DN) | 🛑 **DO NOT USE AS KELVIN** | Qualitative visual PNG pictures. No calibrated temperature units. Must output INSUFFICIENT EVIDENCE. |

---

## 2. Technical Remediations Implemented (Harshil Review Response)

### A. Resolution Transparency & Naming Alignment
* **The Reality:** The downloaded global rasters on disk are 4 pixels/degree (`ldem_4.img` and `megt90n000cb.img`). This is ~7.58 km/pixel for Moon and ~14.8 km/pixel for Mars.
* **Correction:** All documentation, catalogs, and filenames have been corrected. The files are explicitly identified as 4 ppd regional grids. The Jezero sample contains 10 × 10 cells (100 pixels), which represents regional landscape context rather than rover-scale 1–2 km baselines. For high-resolution production modeling, LOLA 64 ppd (`LDEM_64.IMG`, ~530 MB) and MOLA 128 ppd quadrant tiles (`megt00n000cb.img`, ~129 MB) are cataloged.

### B. Latitude-Dependent Polar Slope Calculation
* **The Bug:** Previously, Moon slope was computed using a single center latitude (`-85°`), applying a constant $661\text{ m}$ pixel width across the entire 80°S–90°S band.
* **The Fix in `terrain.py` & `build_samples.py`:**
  Longitudinal ground spacing is now computed dynamically per latitude row:
  $$\Delta x(\text{lat}) = R_{\text{moon}} \times \Delta \lambda \times \cos(\text{lat})$$
  This eliminates polar distortion. Near 89.875°S, $\Delta x$ accurately drops to $\approx 16.5\text{ m}$. `compute_slope_degrees` now accepts a 1D row array of horizontal ground spacings.

### C. NaN Masking & Artificial Cliff Elimination
* **The Bug:** `compute_slope_degrees` previously zero-filled NaNs before running `np.gradient`, creating artificial 90° cliff slopes next to voids or data boundaries.
* **The Fix:** Boundary and nodata-adjacent cells are now identified using a 3×3 stencil dilation mask and explicitly marked as `NaN` in the output slope raster. Valid terrain adjacent to voids is never corrupted by zero-filling.

### D. Mars Projection: Spherical Equirectangular
* **The Bug:** The cylindrical Mars product previously carried an ellipsoid with $b = 3,376,200\text{ m}$ (polar radius).
* **The Fix:** Corrected in `pds_reader.py`, `datasets.json`, and `cleaning_report.json` to a spherical Mars reference ($a = b = 3,396,190\text{ m}$) for simple cylindrical equirectangular projections, per IAU 2000 conventions.

### E. Real Earth SRTM Dataset Activated
* **The Bug:** The Atacama sample previously generated was purely synthetic, while the real SRTM tile `S24W069.hgt` was unused because `build_earth_srtm_sample` was omitted from `BUILDERS`.
* **The Fix:**
  1. `build_earth_srtm_sample` is now registered in `BUILDERS` in `build_samples.py`.
  2. Generated `data/samples/srtm_earth_atacama_sample.csv` (25,000 real rows sampled from 12,967,201 valid pixels of `S24W069.hgt`, elevation 2,201 m to 4,282 m, zero voids).
  3. Generated full 2D raster grids: `srtm_earth_atacama_elevation.npy`, `srtm_earth_atacama_slope.npy`, `srtm_earth_atacama_roughness.npy`.
  4. Quarantined `SYNTHETIC_earth_atacama_analogue_sample.csv` with explicit warnings so it is never mixed with scientific measurements.

### F. Full 2D Spatial Grids Saved (`.npy`)
To support sliding-window local relief ($\Delta h = h_{\max} - h_{\min}$) and 2D spatial filtering without tabular subset sampling biases, the pipeline now exports full 2D NumPy grids for all dimensions:
* **Moon South Pole:**
  * `lola_moon_south_pole_elevation.npy` (40 × 360 grid)
  * `lola_moon_south_pole_slope.npy`
  * `lola_moon_south_pole_roughness.npy`
* **Mars Jezero Crater:**
  * `mola_mars_jezero_elevation.npy` (10 × 10 grid)
  * `mola_mars_jezero_slope.npy`
  * `mola_mars_jezero_roughness.npy`
* **Earth Atacama (SRTM):**
  * `srtm_earth_atacama_elevation.npy` (600 × 600 grid, downsampled from 3601 × 3601)
  * `srtm_earth_atacama_slope.npy`
  * `srtm_earth_atacama_roughness.npy`

### G. Putzig et al. (2005) TES Thermal Inertia Reader
Implemented `read_tes_thermal_inertia(bin_path, mask_path)` in `src/processing/pds_reader.py`:
* Handles Sun workstation big-endian 16-bit integer formatting (`>i2`) and strips the 7,200-byte ASCII header.
* Grid shape: 3,600 rows × 7,200 columns (20 ppd, ~3 km/pixel).
* Applies the binary interpolation mask (1 = real TES observation, 0 = interpolated/unmeasured).

---

## 3. Strict Directives for Harshil's Comparison Engine

Harshil must enforce the following scientific constraints directly in code:

### 1. Absolute Elevation Incompatibility
* **Rule:** Never subtract Earth elevation from Moon or Mars elevation.
  * **Earth:** Elevation relative to EGM96 Geoid / mean sea level.
  * **Mars:** Elevation relative to the gravitational equipotential areoid ($6.1\text{ mbar}$ surface).
  * **Moon:** Elevation relative to a geometric sphere of $R = 1,737.4\text{ km}$.
* **Engine Implementation:** State as `NOT COMPARABLE`. Only compare **local relief** ($\Delta h = h_{\max} - h_{\min}$ within a fixed metric window), **slope distributions**, and **roughness distributions**.

### 2. Spatial Scale Normalization
* **Rule:** Do not correlate raw slopes across different grid footprints.
* **Reason:** Slope calculated on $30\text{ m}$ SRTM represents walking-scale hazards; slope on a $7.6\text{ km}$ or $14.8\text{ km}$ grid averages out entire crater rims.
* **Engine Implementation:** Downsample/resample elevation grids to **one common horizontal metric baseline** before computing slope histograms.

### 3. Thermal State Handling
* ASU THEMIS Day IR PNG mosaics must output `INSUFFICIENT EVIDENCE` (uncalibrated 8-bit image).
* Diviner GDR and TES binary datasets must be flagged as `INSUFFICIENT EVIDENCE (pending ingestion)`.

### 4. Output States
Output strictly one of Zehra's 4 states:
1. `SIMILAR`
2. `DIFFERENT (mismatch)`
3. `INSUFFICIENT EVIDENCE`
4. `NOT COMPARABLE`
No uncalibrated single numerical score should be generated.

---

## 4. Test Suite Verification
The complete test suite in `tests/test_pipeline.py` has been updated with tests for:
* LOLA scaling factor ($0.5$) and radius offset ($1,737,400\text{ m}$) formulas.
* TES thermal inertia binary reading and mask masking.
* Slope NaN boundary masking (zero false cliffs).
* Slope row-varying latitude ground spacing.
* Mars spherical radius ($3,396,190\text{ m}$).
* MD5 verification on existing cached downloads.

**Result:** `58 passed in 52.12s` (100% pass rate).
