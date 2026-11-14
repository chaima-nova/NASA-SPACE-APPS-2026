# Data Sources — NASA Space Apps Pipeline

## Overview
All datasets in this pipeline are sourced from official scientific archives.
Every entry below was researched and verified on **2024-10-18**.

---

## Earth Datasets

### 1. SRTM GL1 — Elevation (30 m)
| Field | Value |
|---|---|
| Full Name | Shuttle Radar Topography Mission Global 1 Arc-Second |
| Agency | NASA / USGS / DLR |
| Instrument | SRTM radar interferometer |
| Landing Page | https://lpdaac.usgs.gov/products/srtmgl1v003/ |
| Download | https://e4ftl01.cr.usgs.gov/MEASURES/SRTMGL1.003/ |
| Format | HGT (binary) or GeoTIFF |
| Resolution | ~30 m at equator |
| Coverage | Global ±60° latitude |
| CRS | EPSG:4326 (WGS84 geographic) |
| Authentication | **Yes — NASA Earthdata account required** |
| License | Open; NASA/USGS attribution required |
| Units | Metres above WGS84 ellipsoid |
| Nodata | -32768 (raw HGT) |
| Reference | Farr et al. (2007). BAMS. doi:10.1175/BAMS-88-8-1213 |

**Access instructions:**
1. Register at https://urs.earthdata.nasa.gov/
2. Fill `.env` with `NASA_EARTHDATA_USERNAME` and `NASA_EARTHDATA_PASSWORD`
3. Run `python scripts/download_data.py --dataset srtm_gl1`

---

### 2. MODIS MOD11A2 — Land Surface Temperature (1 km, 8-day)
| Field | Value |
|---|---|
| Full Name | MODIS/Terra Land Surface Temperature/Emissivity 8-Day L3 Global 1km |
| Agency | NASA LPDAAC |
| Instrument | Terra satellite / MODIS sensor |
| Landing Page | https://lpdaac.usgs.gov/products/mod11a2v061/ |
| Format | HDF-EOS (HDF4) |
| Resolution | 1 km |
| Temporal | 8-day composites, 2000-02-18 to present |
| CRS | MODIS sinusoidal (native); EPSG:4326 after warp |
| Authentication | **Yes — NASA Earthdata account required** |
| License | NASA open data |
| Key Variables | LST_Day_1km, LST_Night_1km (scale: 0.02 K/DN) |
| Nodata | 0 (raw DN) |
| Reference | Wan et al. (2021). Collection 6.1 Algorithm Theoretical Basis Document |

---

### 3. MODIS MCD12Q1 — Land Cover (500 m, annual)
| Field | Value |
|---|---|
| Full Name | MODIS/Terra+Aqua Land Cover Type Yearly L3 Global 500m SIN Grid |
| Agency | NASA LPDAAC |
| Instrument | Terra + Aqua / MODIS |
| Landing Page | https://lpdaac.usgs.gov/products/mcd12q1v061/ |
| Format | HDF-EOS (HDF4) |
| Resolution | 500 m |
| Temporal | Annual, 2001–2022 |
| Authentication | **Yes — NASA Earthdata account required** |
| License | NASA open data |
| Key Variable | LC_Type1 (IGBP classification, integer 0–17) |
| Reference | Friedl & Sulla-Menashe (2022). NASA EOSDIS Land Processes DAAC |

---

## Mars Datasets

### 4. MOLA MEGaDR 128ppd — Mars Global Elevation
| Field | Value |
|---|---|
| Full Name | Mars Orbiter Laser Altimeter Mission Experiment Gridded Data Record, 128ppd |
| Agency | NASA GSFC |
| Instrument | Mars Global Surveyor / MOLA |
| Landing Page | https://pds-geosciences.wustl.edu/missions/mgs/megdr.html |
| Download (IMG) | https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/megt90n000cb.img |
| Download (LBL) | https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/megt90n000cb.lbl |
| Format | PDS3 IMG binary + LBL label |
| Resolution | 128 pixels/degree (~463 m at equator) |
| Coverage | Global (−90° to +90° lat, 0° to 360° lon areographic) |
| CRS | Mars body-fixed areographic; +proj=eqc +a=3396190 +b=3376200 |
| Authentication | **None — publicly accessible** |
| License | NASA PDS open data |
| Units | Metres above Mars areoid (MOLA gravitational datum) |
| Nodata | -32768 (raw MSB int16 DN) |
| Reference | Smith et al. (2001). JGR Planets 106(E10):23689-23722. doi:10.1029/2000JE001364 |

> ⚠ **Datum incompatibility**: The Mars areoid is defined by the MOLA gravitational model, NOT analogous to Earth's WGS84 ellipsoid or the Moon's mean radius. Elevation values should NOT be directly compared numerically across planetary bodies.

---

### 5. MCS DDR — Mars Atmospheric Temperature Profiles
| Field | Value |
|---|---|
| Full Name | MCS Daily Data Record (DDR) — Atmospheric Limb/Nadir Temperature Profiles |
| Agency | NASA JPL |
| Instrument | Mars Reconnaissance Orbiter / MCS |
| Landing Page | https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/MARS/mars_climate_sounder.html |
| Authentication | None |
| Status | **Not implemented in current pipeline** — complex PDS4 binary format |
| Notes | Atmospheric profile data; not surface temperature; requires specialist parsing |

---

## Moon Datasets

### 6. LOLA LDEM_64 — Lunar Global Elevation (64ppd)
| Field | Value |
|---|---|
| Full Name | Lunar Orbiter Laser Altimeter Global Digital Elevation Model, 64ppd |
| Agency | NASA GSFC / LOLA Science Team |
| Instrument | Lunar Reconnaissance Orbiter (LRO) / LOLA |
| Landing Page | https://imbrium.mit.edu/LOLA.html |
| Download (IMG) | https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_64.IMG |
| Download (LBL) | https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_64.LBL |
| Format | PDS3 IMG binary + LBL label |
| Resolution | 64 pixels/degree (~472 m at equator) |
| Coverage | Global |
| CRS | Moon body-fixed selenographic; +proj=eqc +a=1737400 +b=1737400 |
| Authentication | **None — publicly accessible** |
| File Size | ~50 MB |
| License | NASA PDS open data |
| Units | Metres above LOLA mean lunar radius (1737.4 km) |
| Nodata | -32768 (raw LSB int16) |
| Reference | Smith et al. (2010). GRL. doi:10.1029/2010GL043751 |

> ⚠ **Datum incompatibility**: LOLA elevations are measured from the mean lunar radius, not a gravitational geoid. They cannot be directly compared to MOLA or SRTM values.

---

## APIs and Metadata

### 7. NASA Open API — APOD
| Field | Value |
|---|---|
| Landing Page | https://api.nasa.gov/ |
| Endpoint | https://api.nasa.gov/planetary/apod |
| Auth | API key — DEMO_KEY works (rate limited); register free |
| Format | JSON |
| Notes | Used for API connectivity verification; not a scientific dataset |

---

## Access Status Summary

| Dataset ID | Auth Required | Status |
|---|---|---|
| srtm_gl1 | Yes | Endpoint verified; not downloaded (need credentials) |
| modis_lst_terra | Yes | Endpoint researched; not tested |
| modis_lc_mcd12q1 | Yes | Endpoint researched; not tested |
| mola_meg128 | No | **Downloaded and processed** |
| lola_64ppd | No | **Downloaded and processed** |
| nasa_api_apod | API key (free) | **API verified working** |
| mcs_temperature | No | Researched; not implemented |
| mars_ctx_mosaic | No | Researched; not implemented (too large) |

---

## Attribution Requirements

All datasets must be properly attributed in any publication or product:

- **SRTM**: "SRTM data courtesy of the U.S. Geological Survey"
- **MODIS**: "MODIS data products courtesy of the NASA EOSDIS Land Processes DAAC"
- **MOLA**: "MOLA data courtesy of the NASA Planetary Data System (PDS) and the MOLA Science Team"
- **LOLA**: "LOLA data courtesy of the NASA Planetary Data System (PDS) and the LOLA Science Team"
