# Data Dictionary — NASA Space Apps Pipeline

## LOLA 64ppd — Lunar South Pole Sample
**File**: `data/samples/lola_64ppd_moon_south_pole_sample.csv`
**Source**: NASA LOLA LDEM_64 (64 pixels/degree)
**Region**: Lunar South Pole (−90° to −80° latitude, −180° to 180° longitude)

| Field | Description | Units | Type | Valid Range | Nodata |
|---|---|---|---|---|---|
| `latitude` | Pixel centre latitude (selenographic) | degrees north | float64 | [−90, 90] | NaN |
| `longitude` | Pixel centre longitude (selenographic) | degrees east | float64 | [−180, 180] | NaN |
| `elevation_m` | Surface elevation above LOLA mean lunar radius (1737.4 km) | metres | float32 | approx [−9000, 10000] | NaN |
| `slope_deg` | Terrain slope (central difference of elevation grid) | degrees | float32 | [0, 90] | NaN |
| `planet` | Body identifier | text | str | "moon" | — |
| `source` | Dataset identifier | text | str | "LOLA_LDEM_64ppd" | — |
| `crs` | Coordinate reference system | text | str | "selenographic" | — |

**Notes:**
- Elevations are relative to the LOLA mean lunar radius, NOT a gravitational geoid
- Slope values depend on the 64ppd (~472 m) pixel size; finer resolution would give different slopes
- Sample may contain up to 50,000 rows (randomly sampled from full polar region)

---

## MOLA 128ppd — Mars Jezero Crater Sample
**File**: `data/samples/mola_128ppd_mars_jezero_sample.csv`
**Source**: NASA MOLA MEGaDR 128ppd
**Region**: Jezero Crater (~76°–79°E, 17°–20°N areographic)

| Field | Description | Units | Type | Valid Range | Nodata |
|---|---|---|---|---|---|
| `latitude` | Pixel centre latitude (areographic, north positive) | degrees | float64 | [−90, 90] | NaN |
| `longitude` | Pixel centre longitude (areographic, east positive) | degrees | float64 | [−180, 180] | NaN |
| `elevation_m` | Surface elevation above Mars areoid (MOLA gravitational datum) | metres | float32 | approx [−8200, 21000] | NaN |
| `slope_deg` | Terrain slope (central difference of elevation grid) | degrees | float32 | [0, 90] | NaN |
| `planet` | Body identifier | text | str | "mars" | — |
| `source` | Dataset identifier | text | str | "MOLA_MEGADR_128ppd" | — |
| `region` | Named region | text | str | "Jezero Crater" | — |
| `crs` | Coordinate reference system | text | str | "Mars areographic" | — |

**Notes:**
- Mars areoid ≠ Earth geoid ≠ Moon mean radius; do NOT compare elevation values numerically across bodies
- Jezero Crater is the Mars 2020 Perseverance rover landing site
- At 128ppd, pixel size ≈ 463 m at the equator; Jezero slope values reflect this resolution

---

## SYNTHETIC Earth Analogue (ATACAMA) — NOT REAL DATA
**File**: `data/samples/SYNTHETIC_earth_atacama_analogue_sample.csv`

> ⚠ **THIS IS SYNTHETIC DATA. Do not use for scientific analysis.**  
> Replace with real SRTM + MODIS data after setting NASA Earthdata credentials.

| Field | Description | Units | Type | Nodata | Real Source When Available |
|---|---|---|---|---|---|
| `latitude` | Point latitude (WGS84) | degrees north | float64 | NaN | SRTM GL1 / MODIS tile |
| `longitude` | Point longitude (WGS84) | degrees east | float64 | NaN | SRTM GL1 / MODIS tile |
| `elevation_m` | [SYNTHETIC] Terrain elevation above WGS84 ellipsoid | metres | float64 | NaN | SRTM GL1 (30 m) |
| `slope_deg` | [SYNTHETIC] Terrain slope | degrees | float64 | NaN | Derived from SRTM |
| `lst_day_kelvin` | [SYNTHETIC] Daytime land surface temperature | Kelvin | float64 | NaN | MODIS MOD11A2 LST_Day_1km (scale 0.02) |
| `lst_night_kelvin` | [SYNTHETIC] Nighttime land surface temperature | Kelvin | float64 | NaN | MODIS MOD11A2 LST_Night_1km (scale 0.02) |
| `land_cover_igbp` | [SYNTHETIC] IGBP land cover class integer | class code | int | NaN | MODIS MCD12Q1 LC_Type1 |
| `data_source` | Data origin identifier | text | str | — | "SYNTHETIC" |

**IGBP Land Cover Classes (from MODIS MCD12Q1):**

| Code | Class |
|---|---|
| 0 | Water Bodies |
| 1 | Evergreen Needleleaf Forests |
| 2 | Evergreen Broadleaf Forests |
| 5 | Mixed Forests |
| 10 | Grasslands |
| 12 | Croplands |
| 13 | Urban and Built-up |
| 16 | Barren (relevant for analogue research) |
| 17 | Water Bodies |

---

## Cross-Planetary Comparability Notes

The following table documents which variables are genuinely comparable across planetary bodies:

| Variable | Earth | Mars | Moon | Comparability |
|---|---|---|---|---|
| `elevation_m` | SRTM (WGS84) | MOLA (areoid) | LOLA (mean radius) | ❌ NOT directly comparable — different datums |
| `slope_deg` | Derived from SRTM | Derived from MOLA | Derived from LOLA | ⚠ CONDITIONALLY comparable — resolution differences affect values |
| `roughness_tri` | Derived from SRTM | Derived from MOLA | Derived from LOLA | ⚠ CONDITIONALLY comparable — same window size required |
| `lst_day_kelvin` | MODIS MOD11A2 (IR) | TES / MCS (IR/limb) | Diviner LRE | ❌ NOT directly comparable — very different sensor physics and atmosphere |
| `land_cover_igbp` | MODIS MCD12Q1 | N/A | N/A | ❌ Earth-only concept |
| `aridity_index` | Available (CGIAR) | Proxy only | Not applicable | ❌ Do not extrapolate |

> **Important scientific caution**: A similarity in slope or roughness between an Earth location and a Mars/Moon location does NOT mean the locations are physically equivalent environments. Earth's atmosphere, gravity, active geology, biology, and liquid water make direct analogies incomplete at best.
