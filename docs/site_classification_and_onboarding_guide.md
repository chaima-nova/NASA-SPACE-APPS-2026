# TERRANEXUS — Site Classification and Onboarding Guide

**Author:** Harshil (Comparison Engine Lead)  
**Date:** 15 November 2026  
**Version:** 1.1 (Canonical Reference)  
**Target Audience:** Jaz (Frontend Lead), Zehra (Scientific Criteria Lead), Data Pipeline Engineers  

---

## 1. Core Principles

1. **No Composite Score:**  
   "Site X is an 82% match to Mars" is fundamentally unscientific and rejected by TERRANEXUS. The scientific dimensions are orthogonal, and the physical constraints of each planetary body render some parameters incomparable outright.
2. **Independent Scientific Dimensions:**  
   Analogue validity is evaluated across independent dimensions:
   - **Terrain & Topography** (`terrain_topography`)
   - **Surface Geology** (`surface_geology`)
   - **Thermal & Temperature** (`temperature_thermal`)
   - **Solar Illumination & Shadowing** (`solar_illumination`)
3. **Zehra's Four Evidence States:**  
   Every parameter and dimension carries one of four settled states:
   - `SIMILAR` (Operational match within quantified tolerances)
   - `DIFFERENT` (Quantified divergence between distributions or categorical classes)
   - `INSUFFICIENT_EVIDENCE` (Sensor product not yet ingested or coverage $<40\%$)
   - `NOT_COMPARABLE` (Definitional or physical incompatibility)
4. **Universal Physical Limitations:**  
   Every terrestrial site carries the four inescapable physical barriers: gravity ($1.0\text{ g}$ vs $0.166\text{ g}$ / $0.38\text{ g}$), atmospheric pressure ($1,013\text{ hPa}$ vs $10^{-12}\text{ hPa}$ / $6\text{ hPa}$), unshielded ionizing radiation, and soil mechanics/weathering chemistry.

---

## 2. Dimension Decision Rules

### §2.1 Data Gaps & Insufficient Evidence
Where pipeline inputs or calibrated planetary rasters are missing, the state must be `INSUFFICIENT_EVIDENCE` accompanied by an explicit reason stating which instrument product is absent (e.g. Diviner L2 brightness temperature, TES thermal inertia). Under no circumstances may default numbers or synthetic constants be inserted into user-facing metrics.

### §2.2 Terrain & Topography
- **Overlap Ratio ($\text{OR}$):** Evaluated over the central $80\%$ distribution span ($p10\text{--}p90$):
  $$\text{OR} = \frac{\max(0, \min(a_{p90}, b_{p90}) - \max(a_{p10}, b_{p10}))}{\max(a_{p90}, b_{p90}) - \min(a_{p10}, b_{p10})}$$
- **Threshold:** $\text{OR} \ge 0.40$ classifies as `SIMILAR`. $\text{OR} < 0.40$ classifies as `DIFFERENT`.
- **Absolute Elevation Guard:** Absolute elevation ($z_{\text{asl}}$) is **always** marked `NOT_COMPARABLE` due to datum disparity (Earth EGM96 geoid vs Moon $1,737.4\text{ km}$ geometric sphere vs Mars $6.1\text{ mbar}$ areoid). Only local relief ($\Delta h$) and slope angles are compared.
- **Minimum Coverage:** A candidate raster must have $\ge 40\%$ valid non-NaN cells to be classified.

### §2.3 Surface Geology & USGS Crosswalk
- **Geological Units:** Geological units are mapped to the 6 canonical USGS planetary classes (`plains_and_lowlands`, `highland_crust`, `volcanic`, `impact_related`, `polar_and_ice`, `apron_and_transition`).
  - Atacama vs Mars Jezero shares `plains_and_lowlands` $\rightarrow$ `SIMILAR` (`QUALITATIVE_MATCH`).
  - Atacama vs Moon South Pole is disjoint (`plains_and_lowlands` vs `highland_crust`) $\rightarrow$ `DIFFERENT`.
- **Surface Rock Abundance:** Evaluates fractional boulder/cobble ground coverage ($C_{\text{rock}} \in [0\%, 100\%]$):
  - Atacama desert pavement (4.5–15.2% rock fraction, median 9.5%).
  - Mars Jezero (5.0–17.5% boulder fraction, median 10.8% from Perseverance Navcam/Hazcam; 78.5% overlap $\rightarrow$ `SIMILAR`).
  - Moon South Pole (3.2–13.8% blockiness from Diviner Rock Abundance; 77.5% overlap $\rightarrow$ `SIMILAR`).
  - Rover obstacle-clearance and trafficability limits ($<15\%$ rock cover) are directly analogous across all three bodies.
- **Mineralogical Indicators:**
  - Mars Jezero: Perseverance SuperCam and CRISM detect Fe/Mg-smectite clays, hydrated sulfates (gypsum), and carbonates. Atacama salar basins display an identical paleolake evaporite assemblage $\rightarrow$ `SIMILAR`.
  - Moon South Pole: Ancient anorthositic crust (>90% plagioclase feldspar) with cold-trapped water ice in PSRs $\rightarrow$ `DIFFERENT` (igneous crust vs terrestrial sedimentary evaporite).
- **Weathering State:** Permanently marked `DIFFERENT` across all planetary bodies. Earth soil features active microbial, chemical, and aeolian alteration, whereas Moon/Mars regolith is mechanically abrasive or contains reactive perchlorates.

### §2.4 Thermal & Temperature
- **Surface Temperature Range:**
  - Moon South Pole: LRO Diviner brightness temperature spans 38–210 K (PSRs at 38–60 K cold traps; illuminated rims max 210 K). Disjoint from Atacama's 265–305 K envelope (0.0% overlap $\rightarrow$ `DIFFERENT`).
  - Mars Jezero: Perseverance MEDA records ground temperatures from 195 K (-78°C) before dawn to 275 K (+2°C) at solar noon. 9.1% overlap with Atacama at midday peak, but Martian nights drop 70 K colder $\rightarrow$ `DIFFERENT`.
- **Diurnal Thermal Amplitude ($\Delta T_{\text{diurnal}}$):**
  - Unbuffered radiative cooling in hard vacuum or thin 6 hPa $\text{CO}_2$ produces massive swings: Moon polar rims swing up to 175 K; Mars Jezero swings 76–92 K daily.
  - Earth Atacama swing is tightly buffered by atmospheric convective heat flux to 22–36 K (0.0% overlap with Mars $\rightarrow$ `DIFFERENT`).
- **Thermal Inertia ($I = \sqrt{k \rho c}$ in TIU):**
  - Moon South Pole: Vacuum fine regolith has exceptionally low thermal inertia (35–85 TIU, median 55 TIU; 0.0% overlap $\rightarrow$ `DIFFERENT`).
  - Mars Jezero: Consolidated regolith, duricrust, and gravel pavement (310–620 TIU, median 450 TIU from MGS TES / THEMIS) shares **70.5% overlap** with Atacama desert pavement (280–720 TIU, median 460 TIU) $\rightarrow$ **`SIMILAR`**! Duricrust compaction and particle size distributions are thermally analogous.
- **Atmospheric Thermal Physics:** Universal `NOT_COMPARABLE` (1,013 hPa convective boundary layer vs vacuum / 6 hPa $\text{CO}_2$).

### §2.5 Universal Physical Limitations
All sites present the 4 universal physical limitations:
1. **Gravity:** Slope stability, avalanche dynamics, rover traction ($1.0\text{ g}$ vs $0.166\text{ g}$ / $0.38\text{ g}$).
2. **Atmospheric Pressure:** Convective cooling and suit pressurization ($1,013.25\text{ hPa}$ vs vacuum / $6\text{ hPa}$).
3. **Ionizing Radiation:** Geomagnetic shielding vs direct galactic cosmic ray (GCR) flux and solar particle events.
4. **Soil Mechanics & Weathering:** Active biotic/water weathering vs micrometeorite agglutinates or reactive toxic perchlorates.

### §2.6 Solar Illumination & Shadowing
- **Moon South Pole:** Grazing incidence ($\pm 1.5^\circ$) creates binary Permanently Shadowed Regions (PSRs, $<40\text{ K}$) and Peaks of Eternal Light (PELs, $70\text{--}88\%$). Overlap with Atacama's 12h diurnal daylight is $<10\%$ $\rightarrow$ `DIFFERENT`. Diurnal cycle period is `NOT_COMPARABLE`.
- **Mars Jezero:** Sol length ($24.66\text{ h}$) and $\sim 50\%$ annual daylight fraction operationally match Earth's $24.00\text{ h}$ diurnal cycle $\rightarrow$ `SIMILAR`. Solar irradiance flux is `DIFFERENT` ($590\text{ W/m}^2$ vs $1,361\text{ W/m}^2$, requiring $2.3\times$ photovoltaic collector area).

---

## 3. UI Implementation Guide (For Jaz)

When updating the web app to reflect Version 1.1:
1. **Types (`src/data-contracts/types.ts`):**
   ```typescript
   export type DimensionStates = Partial<
     Record<'terrain' | 'geology' | 'thermal' | 'illumination', EvidenceState>
   >;
   ```
2. **API Mapping (`src/services/api.ts`):**
   ```typescript
   const DIMENSION_KEY: Record<string, keyof DimensionStates> = {
     terrain_topography: 'terrain',
     surface_geology: 'geology',
     temperature_thermal: 'thermal',
     solar_illumination: 'illumination',
   };
   ```
3. **Classification Order & Labels (`src/lib/classification.ts`):**
   ```typescript
   export type DimensionId = 'terrain' | 'geology' | 'thermal' | 'illumination';
   export const DIMENSION_ORDER: DimensionId[] = ['terrain', 'geology', 'thermal', 'illumination'];
   export const DIMENSION_LABELS: Record<DimensionId, string> = {
     terrain: 'Terrain & Topography',
     geology: 'Surface Geology',
     thermal: 'Thermal & Temperature',
     illumination: 'Solar Illumination & Shadowing',
   };
   ```
4. **Dossier Header (`src/components/panels/SiteInspector.tsx`):**
   Display dynamic agreement count:
   ```tsx
   {classification.agreements} of {classification.dimensions.length} similar
   ```
   Replace the hardcoded Moon caveat with the engine's dynamic note.
