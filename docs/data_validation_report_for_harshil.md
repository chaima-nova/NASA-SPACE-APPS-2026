# DATA VALIDATION & READINESS REPORT
**Workstream:** Data Ingestion & Processing (Abid T S)  
**Recipients:** Harshil (Comparison Engine Implementation), Zehra (Scientific Criteria), Team Lead  
**Date:** 14 November 2026  
**Reference Framework:** TERRANEXUS (Zehra, 13 Nov 2026)

---

## 1. Executive Summary

As requested prior to engine implementation, all downloaded datasets in `data/raw/`, `data/interim/`, and `data/samples/` have been audited against Zehra’s *Planetary Reference Framework*.

| Dataset / Product | Dimension | Status for Harshil | Evidence Type | Key Caveat / Constraint |
|---|---|---|---|---|
| **LOLA GDR (`ldem_4.img`)** | Moon Topography | ✅ **READY TO USE** | Direct measurement | Scaling factor = 0.5; height relative to 1737.4 km sphere. |
| **MOLA MEGDR (`megt90n000cb.img`)** | Mars Topography | ✅ **READY TO USE** | Direct measurement | MSB 16-bit integer; elevation relative to Mars areoid. |
| **SRTM GL1 (`S24W069.hgt`)** | Earth Topography | ✅ **READY TO USE** | Direct measurement | 30 m grid. Must downsample before comparing slopes. |
| **Earth Atacama Analogue Sample** | Earth Multi-param | ⚠️ **PARTIAL / SYNTHETIC** | Synthetic placeholder | LST & Land Cover are synthetic placeholders. Topography is real. |
| **THEMIS IR / Thermal Inertia** | Mars Thermal | 🛑 **DO NOT USE (BLOCKED)** | Qualitative Image | ASU PNGs and USGS 8-bit maps are non-numeric pictures. |
| **Diviner GDR L2/L3** | Moon Thermal/Rock | ⏳ **PENDING INGESTION** | Direct / Model | Not yet in local raw cache. Flag as `INSUFFICIENT EVIDENCE`. |

---

## 2. Detailed Technical Audit of Downloaded Datasets

### A. Moon Topography: LOLA GDR Level 4 (`LDEM_4.IMG` + `LDEM_4.LBL`)
* **PDS Data Set ID:** `LRO-L-LOLA-4-GDR-V1.0` *(Complies with Zehra's correction: this is the GDRDEM pixel map, NOT the SHADR spherical harmonic file)*.
* **Format & Type:** Uncompressed PDS3 binary raster, 720 lines × 1440 line samples.
* **Byte Order & Datatype:** 16-bit signed integer (`LSB_INTEGER`, Little-Endian).
* **Scaling Factor & Offset:**
  * `SCALING_FACTOR = 0.5`
  * `OFFSET = 1737400.0`
  * **Elevation Formula:** $\text{Elevation (m)} = \text{DN} \times 0.5$
  * **Planetary Radius Formula:** $\text{Radius (m)} = (\text{DN} \times 0.5) + 1737400.0$
* **Verified Value Range:**
  * Raw DN: $[-17758, 21008]$
  * Numeric Elevation: **$-8,878.5\text{ m}$ to $+10,504.0\text{ m}$**
* **Nodata / Masking:** 0 invalid/nodata pixels in this global grid.
* **Spatial Coverage & Resolution:**
  * Global coverage: $-90^\circ$ to $+90^\circ$ Lat, $0^\circ$ to $360^\circ$ Lon.
  * Resolution: $4\text{ pixels/degree}$ ($\approx 7.58\text{ km/pixel}$ at equator).
* **Pre-Built Sample for Harshil:**
  * `data/samples/lola_moon_south_pole_sample.csv` (25,000 points, $80^\circ\text{S} - 90^\circ\text{S}$, includes derived `slope_deg` and `roughness_tri_m`).

---

## 3. Strict Directives for Harshil's Comparison Engine

Harshil must enforce the following scientific constraints directly in the comparison pipeline code:

### 1. The Absolute Elevation Incompatibility
* **Rule:** Never subtract Earth elevation from Moon or Mars elevation.
  * **Earth:** Elevation is relative to mean sea level (EGM96 geoid / WGS84).
  * **Mars:** Elevation is relative to the areoid ($6.1\text{ mbar}$ equipotential gravity surface).
  * **Moon:** Elevation is relative to an arbitrary reference sphere of $R = 1,737.4\text{ km}$.
* **Engine Implementation:** State as `NOT COMPARABLE`. Only compare **local relief** ($\Delta h = h_{\max} - h_{\min}$ inside a fixed metric window), **slope distributions**, and **roughness**.

### 2. Resolution Mismatch (Scale Dependency)
* **Rule:** Do not compare raw slope from SRTM ($30\text{ m}$) against MOLA ($14.8\text{ km}$ / $463\text{ m}$) or LOLA ($7.5\text{ km}$).
* **Reason:** $15^\circ$ slope on a $30\text{ m}$ Earth grid captures micro-ravines; on a $14\text{ km}$ Mars grid it reflects regional mountain faces. Direct comparison yields false `DIFFERENT (mismatch)` errors.
* **Engine Implementation:** Harshil must resample/downsample elevation grids to **one common horizontal metric baseline** before calculating slope distributions.

### 3. Thermal Dimension Restrictions
* **THEMIS Day IR Mosaic:** As Zehra flagged, ASU THEMIS tiles are 8-bit PNG images. **Do NOT parse pixel values as Kelvin temperature.**
* **Current Earth LST:** In `data/samples/SYNTHETIC_earth_atacama_analogue_sample.csv`, the columns `lst_day_kelvin` and `lst_night_kelvin` are synthetic placeholders. Set thermal scoring to `INSUFFICIENT EVIDENCE` until genuine MODIS/ECOSTRESS and Diviner L2/TES binary granules are loaded.

### 4. Output States
Harshil's comparison engine must output strictly one of Zehra's 4 states:
1. `SIMILAR`
2. `DIFFERENT (mismatch)`
3. `INSUFFICIENT EVIDENCE`
4. `NOT COMPARABLE`
No uncalibrated single numerical score should be generated.

