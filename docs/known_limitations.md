# Known Scientific & Technical Limitations

## 1. Executive Summary
This document details the scientific boundaries, physical limitations, coordinate discrepancies, and technical caveats that must govern all analysis performed on data processed by this pipeline. 

> [!CAUTION]
> **The Planetary Analogue Fallacy:**  
> Finding an Earth site (such as the Atacama Desert, Antarctica Dry Valleys, or Hawaiian basalt flows) with surface roughness or aridity similar to Mars or the Moon **does NOT mean the site is habitable, safe, or biologically equivalent**. Terrestrial analogues serve strictly as operational, geological, or instrument-testing proxies.

---

## 2. Vertical Datums and Planetary Reference Surfaces

Elevation numbers across Earth, Mars, and the Moon **cannot be directly compared as absolute values**. Each body references an entirely distinct physical baseline:

| Planetary Body | Primary Dataset | Reference Datum | Physical Meaning | Key Caveat |
|---|---|---|---|---|
| **Earth** | SRTM GL1 | WGS84 Ellipsoid / EGM96 Geoid | Mean sea level adjusted for Earth's gravitational potential | 0 m represents ocean surface equilibrium. |
| **Mars** | MOLA 128ppd | Mars Areoid | Constant gravitational equipotential surface based on radio science & MGS tracking | 0 m is an arbitrary gravitational reference surface where average atmospheric pressure was historically ~6.1 mbar. |
| **Moon** | LOLA 64ppd | Mean Lunar Sphere ($R = 1737.4\text{ km}$) | Geometric sphere of fixed 1,737.4 km radius centered at lunar center-of-mass | The Moon lacks an atmosphere and liquid water; 0 m is purely a geometric radius, **not a gravity equipotential surface**. |

### Practical Rule for Downstream Modeling:
- **Do NOT calculate:** $\Delta \text{Elevation} = \text{Elev}_{\text{Earth}} - \text{Elev}_{\text{Mars}}$
- **DO calculate relative metrics:**
  - Local relief ($\text{Elev}_{\max} - \text{Elev}_{\min}$ within a 5 km window)
  - Surface slope (inclination angle in degrees)
  - Terrain Ruggedness Index (TRI / surface roughness)

---

## 3. Spatial Resolution & Scale Dependency

Geomorphological properties like slope, curvature, and roughness are intrinsically **scale-dependent**.

| Body | Dataset | Native Resolution | Spatial Scale Context |
|---|---|---|---|
| **Earth** | SRTM GL1 | ~30 m / pixel | Resolves small ravines, road cuts, dunes, and buildings |
| **Mars** | MOLA 128ppd | ~463 m / pixel (at equator) | Resolves large impact craters, volcanic calderas, and chasmata; smooths local boulders and rover-scale hazards |
| **Moon** | LOLA 64ppd | ~472 m / pixel | Resolves regional rims and basin morphology; misses meter-scale boulders and micro-craters |

### The Scale Caveat:
- A slope of $15^\circ$ calculated on a 30 m SRTM grid reflects true walking-scale steepness.
- A slope of $15^\circ$ calculated on a 463 m MOLA grid averages out steep micro-features and represents regional terrain inclination.
- **Do not directly correlate raw slope degrees across differing grid resolutions without resampling or filtering to a common spatial footprint.**

---

## 4. Atmospheric, Radiation & Thermal Regimes

Direct comparison of environmental temperatures or aridity must account for extreme physical disparities:

### 4.1 Atmospheric Pressure & Composition
- **Earth**: $\approx 1013\text{ hPa}$, $78\%\text{ N}_2, 21\%\text{ O}_2$. Dense convective atmosphere, strong hydrological cycle.
- **Mars**: $\approx 6\text{ hPa}$ ($<1\%$ of Earth), $95\%\text{ CO}_2$. Insufficient pressure for liquid water; high ultraviolet radiation flux.
- **Moon**: $\approx 10^{-12}\text{ hPa}$ (hard vacuum). No atmospheric protection from cosmic rays, solar energetic particles, or micrometeorites.

### 4.2 Surface Temperature Dynamics
- **Earth (MODIS)**: Land Surface Temperature (LST) typically ranges from $-50^\circ\text{C}$ to $+60^\circ\text{C}$. High thermal inertia from atmosphere and moisture.
- **Mars (TES/MCS)**: Diurnal swings can exceed $100^\circ\text{C}$ at the equator (e.g., $+20^\circ\text{C}$ midday to $-100^\circ\text{C}$ night). Polar winter reaches $-130^\circ\text{C}$ (dry ice precipitation).
- **Moon (Diviner)**: Diurnal cycle lasts 29.5 Earth days. Equatorial midday exceeds $+120^\circ\text{C}$ (393 K), while lunar night drops to $-130^\circ\text{C}$ (140 K). Permanently Shadowed Regions (PSRs) at the poles can be as cold as $-246^\circ\text{C}$ (27 K), trapping volatile water-ice.

---

## 5. Mineralogy and Regolith Hazards

- **Lunar Regolith**: Extremely abrasive, jagged, electrostatic dust shards created by billions of years of meteorite impact without atmospheric weathering. Causes mechanical wear, seal erosion, and respiratory hazards for suits and habitats.
- **Martian Dust**: Fine, iron-oxide rich dust containing toxic chlorine perchlorates ($\text{ClO}_4^-$) harmful to human thyroid function and plant growth without remediation.
- **Earth Soil**: Chemically and biologically weathered, containing organic matter, clays, and hydrous minerals absent in pristine lunar conditions.

---

## 6. Access, Credentials & Pipeline Execution Boundaries

1. **NASA Earthdata Login Requirements**:
   - Automated downloading of SRTM and MODIS data from LP DAAC requires user credentials.
   - If `.env` credentials are missing or the execution host lacks direct Internet access, the pipeline falls back to offline validated synthetic samples.
2. **Global Raster Volume**:
   - Full global MOLA and LOLA rasters are several gigabytes in size.
   - The pipeline downloads targeted regional subsets and generates downsampled samples to ensure rapid testing on standard developer workstations.
3. **Pending Challenge Focus Areas**:
   - The team’s three specific challenge focus areas remain to be formally finalized. The pipeline is intentionally decoupled so additional data products can be registered in `config/datasets.json` without restructuring core logic.
