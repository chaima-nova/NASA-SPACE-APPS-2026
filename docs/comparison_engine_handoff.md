# TERRANEXUS Comparison Engine — Handoff Guide

**Target Audience:** Jaz (3D Web App Lead), Zehra (Scientific Criteria Lead), Presentation & Pitch Team  
**Author:** Harshil (Comparison Engine Lead)  
**Date:** 14 November 2026  
**Status:** ✅ Production-Ready for Hackathon Demo (67/67 tests passing, 72/72 audit assertions verified)

---

## 1. Executive Summary & Deliverables

The **TERRANEXUS Comparison Engine** is fully implemented, verified, and aligned with Zehra's scientific framework. It evaluates Earth candidate sites against Moon and Mars reference regions across **3 dimensions** (Terrain, Geology, Thermal) using **Zehra's 4 evidence states**, with **zero composite numerical scoring**.

### Ready-to-Use Static JSON Deliverables for Jaz:
The pre-computed reports for the demo are located in `reports/`:

| File | Candidate | Target Body | Target Region | File Size |
|---|---|---|---|---|
| [`reports/comparison_results_atacama_vs_moon.json`](NASA-SPACE-APPS-2026/reports/comparison_results_atacama_vs_moon.json) | Earth Atacama (`earth_atacama_s24w069`) | **Moon** | Lunar South Pole (80°S–90°S) | 11.4 KB |
| [`reports/comparison_results_atacama_vs_mars.json`](NASA-SPACE-APPS-2026/reports/comparison_results_atacama_vs_mars.json) | Earth Atacama (`earth_atacama_s24w069`) | **Mars** | Jezero Crater (17°N–20°N) | 12.8 KB |

*(Also aliased to `comparison_results_earth_atacama_s24w069_vs_moon.json` and `comparison_results_earth_atacama_s24w069_vs_mars.json`)*.

---

## 2. JSON Schema & Frontend Integration Guide (For Jaz)

The JSON structure matches the agreed-upon dimension-first schema.

### 2.1 Top-Level Architecture
```json
{
  "candidate_id": "earth_atacama_s24w069",
  "engine_version": "1.0.0",
  "framework": "TERRANEXUS",
  "location": { ... },
  "planetary_context": { ... },
  "dimensions": {
    "terrain_topography": { ... },
    "surface_geology": { ... },
    "temperature_thermal": { ... }
  },
  "data_quality": { ... },
  "uncertainties": [ ... ],
  "limitations": [ ... ]
}
```

### 2.2 Location & Planetary Context
* `location.coordinates`: `[lat, lon]` center point (`[-23.5, -68.5]`) for 3D globe camera positioning.
* `location.bbox`: `[min_lon, min_lat, max_lon, max_lat]` for bounding box overlays.
* `planetary_context.target_body`: `"moon"` or `"mars"`.
* `planetary_context.target_bbox`: Bounding box of the target planetary ROI.

### 2.3 Dimensions Breakdown (`dimensions.<dimension_name>`)
Each dimension has 4 primary fields:
1. `status`: High-level summary string (e.g. `"DIFFERENT"`, `"QUALITATIVE_MATCH"`, `"INSUFFICIENT_EVIDENCE"`).
2. `similarities[]`: Array of `ParameterResult` objects that matched.
3. `mismatches[]`: Array of `ParameterResult` objects that differed or were physically incompatible.
4. `evidence[]`: Array of `ParameterResult` objects providing context, missing data flags, or datum warnings.

### 2.4 Structure of a `ParameterResult`
```json
{
  "parameter": "slope_deg",
  "state": "DIFFERENT",
  "evidence_type": "model_derived",
  "summary": "Distributions overlap only 31.9% (below 40% threshold). Candidate median 2.028 ° is 5.51 ° lower than target median 7.541 °.",
  "candidate_stats": {
    "count": 361201,
    "p10": 0.229,
    "p25": 0.529,
    "p50": 2.028,
    "p75": 4.039,
    "p90": 7.379,
    "mean": 3.12,
    "std": 3.763,
    "unit": "°",
    "source": "Pre-computed by terrain.py at 180 m/px"
  },
  "target_stats": {
    "count": 14400,
    "p10": 1.953,
    "p25": 3.867,
    "p50": 7.541,
    "p75": 12.133,
    "p90": 17.22,
    "mean": 8.909,
    "std": 6.942,
    "unit": "°",
    "source": "Pre-computed by terrain.py at 7.6 km/px"
  },
  "overlap_pct": 31.9,
  "wasserstein": 5.805,
  "direction_note": "Distributions overlap only 31.9%..."
}
```

### 2.5 Suggested Frontend Badges & Color Palette (For Jaz's UI)

| Evidence State (`state`) | Badge Color | Meaning for User |
|---|:---:|---|
| `SIMILAR` | 🟢 Green (`#22c55e`) | Parameter distributions share $\ge 40\%$ overlap or match in geological crosswalk. |
| `DIFFERENT` | 🔴 Red/Orange (`#ef4444`) | Distributions diverge ($< 40\%$ overlap) or units differ. |
| `INSUFFICIENT_EVIDENCE` | 🟡 Amber/Yellow (`#f59e0b`) | Sensor data not yet ingested or resolution inadequate. |
| `NOT_COMPARABLE` | ⚪ Gray/Slate (`#64748b`) | Physically or mathematically incompatible (e.g. datum disparity). |

---

## 3. JavaScript / TypeScript Loading Example (For Jaz)

```typescript
// Load pre-computed TERRANEXUS comparison report
async function loadComparisonReport(targetBody: 'moon' | 'mars') {
  const response = await fetch(`/reports/comparison_results_atacama_vs_${targetBody}.json`);
  const report = await response.json();

  console.log(`Loaded candidate ${report.candidate_id} vs ${report.planetary_context.target_region}`);
  
  // Render Terrain Dimension
  const terrain = report.dimensions.terrain_topography;
  console.log(`Terrain Status: ${terrain.status}`);
  
  // Render Physical Limitations Panel
  report.limitations.forEach(lim => {
    console.log(`Factor: ${lim.factor} | Earth: ${lim.earth} -> Target: ${lim.target}`);
    console.log(`Impact: ${lim.impact}`);
  });

  return report;
}
```

---

## 4. Scientific Guardrails & Presentation Narrative (For Zehra & Pitch Team)

When presenting TERRANEXUS to the judges, emphasize that our platform is **scientifically rigorous**, not an arbitrary score generator:

### 1. Why No Single Composite Score?
* Standard machine learning approaches calculate a single number (e.g. "Atacama is an 84% match to Mars"). In planetary science, this is invalid and dangerous:
  * A rover chassis designed for Earth gravity ($1.0\text{ g}$) will flip on lunar slopes ($0.166\text{ g}$) even if the slope angles are identical.
  * An habitat cooling system designed for Earth's convective atmosphere ($1,013\text{ hPa}$) will fail completely in the lunar vacuum ($10^{-12}\text{ hPa}$).
* TERRANEXUS breaks down comparability **dimension-by-dimension**, giving engineers actionable feasibility criteria.

### 2. Absolute Elevation is Always `NOT_COMPARABLE`
* Earth elevation is tied to the **EGM96 geoid** (mean sea level).
* Moon elevation is tied to a **$1,737.4\text{ km}$ geometric sphere** (no gravity equipotential).
* Mars elevation is tied to a **gravitational areoid** ($6.1\text{ mbar}$ pressure surface).
* Comparing $+2,500\text{ m}$ on Earth to $-2,000\text{ m}$ on Mars is meaningless. Instead, we compare **local relief** ($\Delta h$ inside a metric window) and **slope**.

### 3. Surface Roughness & Resolution Caveat
* Earth SRTM is measured at $\sim 180\text{ m/px}$; LOLA Moon is at $\sim 7.58\text{ km/px}$.
* Earth TRI roughness is $\sim 17\text{ m}$, while Moon is $\sim 1,464\text{ m}$. This difference is a **resolution footprint artefact**, not terrain truth. Our engine explicitly flags this instead of claiming the terrains are fundamentally mismatched.

### 4. Thermal & Geology Honesty
* Thermal parameters are marked `INSUFFICIENT_EVIDENCE` with specific instrument reasons (e.g., waiting for calibrated Diviner Level 2 brightness temperature and TES numeric grids).
* Geology uses a transparent 6-class USGS crosswalk (Fortezzo 2020, Tanaka 2014) rated with explicit confidence tags.

---

## 5. Verification & Engine Commands

To regenerate reports or run tests:

```powershell
# 1. Run engine to regenerate reports
.\.venv\Scripts\python scripts/run_comparison.py

# 2. Run automated deliverable audit (72 assertions)
.\.venv\Scripts\python scripts/audit_deliverables.py

# 3. Run full test suite (67 tests, 100% passing)
.\.venv\Scripts\pytest -v
```

---

## 6. Contacts
* **Engine & Statistics:** Harshil
* **Data Ingestion & Rasters:** Abid T S
* **Scientific Taxonomy:** Zehra
* **3D Frontend & UI:** Jaz
