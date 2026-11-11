# NASA Space Apps Challenge — Planetary Data Engineering Pipeline

[![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/downloads/)
[![Tests](https://img.shields.io/badge/pytest-passing-brightgreen.svg)]()
[![License](https://img.shields.io/badge/license-NASA%20Open%20Data-lightgrey.svg)]()

> **Challenge Role**: NASA Data / Platform Lead  
> **Team Members**: Farwa, Harshil, and Platform Lead  
> **Mission**: Build an automated, reusable, scientifically validated data engineering pipeline for cross-planetary and terrestrial analogue research.

---

## 1. Project Overview & Context

This repository houses an end-to-end data pipeline built for the NASA International Space Apps Challenge. Our objective is to establish a rigorous, modular data foundation that ingests, cleans, validates, and samples genuine scientific planetary datasets from authoritative NASA and international space science repositories:
- **NASA Planetary Data System (PDS)** Geosciences Node (Washington University in St. Louis)
- **NASA Earthdata / LP DAAC** (Land Processes Distributed Active Archive Center)
- **NASA Open APIs** and **Common Metadata Repository (CMR)**
- **USGS Astrogeology & Earth Resources Observation and Science (EROS)**

### Planetary Focus: Earth, Mars & Moon Analogues
Our current investigation focuses on identifying Earth locations that exhibit geomorphological, thermal, and terrain characteristics analogous to target environments on Mars and the Moon (e.g. lunar permanently shadowed regions, Martian impact basins, and terrestrial hyper-arid deserts). The pipeline is explicitly configurable to seamlessly adapt as the team finalizes its three specific challenge focus areas.

---

## 2. Key Engineering Features

- **Genuine Scientific Access**: Direct, streaming HTTP connections to NASA PDS archives (LOLA lunar altimetry, MOLA Martian topography) and Earthdata CMR discovery endpoints.
- **Robust Ingestion**: Resilient streaming downloads with chunked buffers, exponential backoff retries, SSL session pooling, and size-based caching to prevent redundant transfers.
- **PDS3 Binary Parser**: Native Python parser for PDS3 labels (`.LBL`) and big-endian 16-bit binary rasters (`.IMG`) without fragile native C dependencies.
- **Terrain Derivation Engine**: Calculates planetary physical pixel dimensions, slope angles in degrees (via central difference gradient operators), and Terrain Ruggedness Index (TRI) surface roughness.
- **Strict Data Validation & QA**: Transparent quality flagging (`qa_flag`) for invalid coordinates, missing data, and duplicate observations. No silent drops.
- **Full Provenance & Auditing**: Detailed execution logs (`reports/pipeline.log`) and structured JSONL audit trails (`reports/provenance.jsonl`).
- **Teammate-Ready Samples**: Pre-packaged CSVs, NumPy arrays, and automated loader scripts in `data/samples/` for immediate analysis by teammates Farwa and Harshil.

---

## 3. Repository Structure

```
nasa-data-pipeline/
├── config/
│   ├── datasets.json            # Dataset definitions, URLs, access methods, schemas
│   └── settings.json            # Pipeline config, ROIs, download limits, focus areas
├── data/
│   ├── raw/                     # Immutable raw source downloads (PDS, Earthdata)
│   │   ├── earth/
│   │   ├── mars/
│   │   └── moon/
│   ├── interim/                 # Intermediate clipped rasters and parsed headers
│   ├── processed/               # Standardized, cleaned tabular & geospatial data
│   └── samples/                 # Lightweight samples for Farwa & Harshil (<5 MB each)
├── docs/
│   ├── dataset_catalog.csv      # Complete dataset catalog with access & license status
│   ├── data_sources.md          # Scientific literature citations & official landing pages
│   ├── data_dictionary.md       # Field definitions, units, types, and nodata conventions
│   ├── pipeline_architecture.md # System architecture and engineering design
│   ├── known_limitations.md     # Cross-planetary comparison limitations and geoid warnings
│   └── teammate_handoff.md      # Actionable handoff instructions for teammates
├── reports/
│   ├── pipeline.log             # Unified console and stage execution log
│   ├── provenance.jsonl         # Detailed JSONL audit trail
│   └── validation_report.json   # Machine-readable validation test results
├── scripts/
│   ├── discover_datasets.py     # Stage 1: Dataset endpoint reachability discovery
│   ├── download_data.py         # Stage 2: Resilient data ingestion
│   ├── inspect_data.py          # Stage 3: Raw data schema and metadata inspection
│   ├── clean_data.py            # Stage 4: Cleaning and standardisation
│   ├── validate_data.py         # Stage 5: Schema and bound validation
│   ├── build_samples.py         # Stage 6: Sample dataset generation
│   └── run_pipeline.py          # Master orchestrator
├── src/
│   ├── ingestion/               # Modular network downloaders and API clients
│   ├── processing/              # PDS3 readers, terrain derivation, standardisation
│   ├── validation/              # Automated data validation and audit suite
│   └── provenance/              # Execution audit tracking
├── tests/
│   └── test_pipeline.py         # Comprehensive pytest suite (53 tests)
├── .env.example                 # Template for NASA Earthdata and API credentials
├── .gitignore                   # Excludes heavy raw rasters, secrets, and temp caches
├── README.md                    # Project overview, quickstart, and execution guide
└── requirements.txt             # Locked Python package dependencies
```

---

## 4. Quickstart Guide

### 4.1 Prerequisites & Installation
Ensure Python 3.10+ is installed on your workstation:
```bash
# Clone or open the workspace directory
cd nasa

# Install required dependencies
pip install -r requirements.txt
```

### 4.2 Environment Configuration (Optional)
For authenticated access to NASA Earthdata (SRTM and MODIS products):
```bash
cp .env.example .env
# Edit .env with your NASA Earthdata credentials and NASA API Key:
# NASA_EARTHDATA_USERNAME=your_username
# NASA_EARTHDATA_PASSWORD=your_password
# NASA_API_KEY=your_api_key
```
*Note: NASA PDS datasets (Moon LOLA, Mars MOLA) and CMR Discovery are public and do not require credentials.*

### 4.3 Running the Complete Pipeline
To execute all stages in sequence (Discovery → Download → Inspection → Cleaning → Validation → Sample Building):
```bash
python scripts/run_pipeline.py
```

### 4.4 Running Individual Pipeline Stages
```bash
# 1. Discover reachable datasets and check API endpoints:
python scripts/discover_datasets.py

# 2. Ingest raw datasets from verified sources:
python scripts/download_data.py

# 3. Inspect raw file headers, dimensions, and metadata:
python scripts/inspect_data.py

# 4. Clean, flag missing values, and validate coordinates:
python scripts/clean_data.py

# 5. Run schema enforcement and compile validation report:
python scripts/validate_data.py

# 6. Generate lightweight sample files for teammates:
python scripts/build_samples.py
```

### 4.5 Running Automated Tests
Run the comprehensive pytest suite:
```bash
python -m pytest tests/ -v
```

---

## 5. Ready Sample Datasets for Farwa & Harshil

Sample datasets are located in `data/samples/`:
1. `lola_64ppd_moon_south_pole_sample.csv`: Lunar South Pole elevation and derived slope (~472 m resolution).
2. `mola_128ppd_mars_jezero_sample.csv`: Mars Jezero Crater Perseverance landing area topography and slope (~463 m resolution).
3. `SYNTHETIC_earth_atacama_analogue_sample.csv`: Documented synthetic terrestrial analogue sample for testing algorithms while awaiting Earthdata credentials.
4. `data_dictionary.csv`: Master machine-readable dictionary covering field names, descriptions, units, types, and valid intervals.

Quick Python loader:
```python
import pandas as pd

# Load Lunar South Pole sample
df_moon = pd.read_csv("data/samples/lola_64ppd_moon_south_pole_sample.csv")
print(df_moon.head())
```
*See [docs/teammate_handoff.md](docs/teammate_handoff.md) for full usage examples and task assignments.*

---

## 6. Scientific Limitations & Planetary Integrity

When conducting comparative planetary analysis, keep in mind:
- **No Direct Elevation Subtraction**: Earth elevations reference the WGS84 ellipsoid/geoid (mean sea level); Mars elevations reference the areoid (gravitational equipotential surface); Lunar elevations reference a fixed $1737.4\text{ km}$ sphere.
- **Scale Matters**: A slope calculated across 30 m pixels (SRTM) cannot be directly compared to a slope calculated across 472 m pixels (LOLA) without multi-scale smoothing.
- **Analogue != Habitable**: Terrestrial extreme environments provide geological or operational testing analogues, but completely diverge in atmospheric pressure, radiation flux, and thermal cycles.

*For full scientific guidelines, see [docs/known_limitations.md](docs/known_limitations.md).*

---

## 7. Configuration & Future Adaptation

To modify the target regions of interest, add new NASA datasets, or adjust download thresholds when the challenge focus areas are confirmed:
- Edit `config/settings.json` to change bounding boxes, download limits, or active focus areas.
- Edit `config/datasets.json` to register new NASA products, URLs, and access methods.
