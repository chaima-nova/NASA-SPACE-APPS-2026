# NASA Space Apps Pipeline Architecture

## 1. System Mission & High-Level Design

The **NASA Space Apps Data Pipeline** is an enterprise-grade, modular, and scientifically rigorous geospatial data engineering system. It is designed to discover, ingest, clean, validate, transform, and sample planetary and terrestrial datasets from official NASA and international scientific repositories (NASA Earthdata / LP DAAC, NASA Planetary Data System (PDS) Geosciences Node, and NASA Open APIs).

The architecture adheres to three core scientific principles:
1. **Provenance & Integrity**: Raw scientific granules are preserved immutably. Every HTTP interaction, checksum, and transformation is tracked in structured JSONL provenance logs.
2. **Scientific Honesty & Explicit QA**: No silent discarding of anomalous observations or mismatched datums. Data quality flags (`qa_flag`) transparently track missing values, invalid coordinates, and duplicate records.
3. **Configurability & Extensibility**: All dataset endpoints, spatial regions, download throttles, and focus areas are decoupled into JSON configuration files (`config/`), allowing immediate adaptation when challenge requirements evolve.

---

## 2. End-to-End Pipeline Workflow

```
[ NASA Data Sources ]
  - PDS Geosciences (LOLA / MOLA)
  - NASA Earthdata (SRTM / MODIS)
  - NASA Open APIs / CMR
           │
           ▼
┌─────────────────────────┐
│ 1. Discovery Stage      │  scripts/discover_datasets.py
│    - URL reachability   │  src/ingestion/nasa_api.py (CMR query)
│    - Endpoint auditing  │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ 2. Ingestion Stage      │  scripts/download_data.py
│    - Chunked streaming  │  src/ingestion/base.py
│    - Backoff retries    │  src/ingestion/pds.py
│    - Checksum & cache   │  src/ingestion/earthdata.py
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ 3. Inspection Stage     │  scripts/inspect_data.py
│    - PDS3 / GeoTIFF hdr │  src/processing/pds_reader.py
│    - Dimensions & types │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ 4. Processing & Clean   │  scripts/clean_data.py
│    - Column norm        │  src/processing/cleaner.py
│    - Spatial extraction │  src/processing/terrain.py
│    - Slope & roughness  │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ 5. Validation Stage     │  scripts/validate_data.py
│    - Schema enforcement │  src/validation/validators.py
│    - Value bounds check │
│    - Reports generation │  reports/validation_report.json
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ 6. Sample Generation    │  scripts/build_samples.py
│    - Farwa/Harshil CSVs │  src/processing/sample_builder.py
│    - Data dictionaries  │  data/samples/
│    - Loading scripts    │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ 7. Orchestration        │  scripts/run_pipeline.py
│    - Master execution   │  reports/pipeline.log
│    - Provenance log     │  reports/provenance.jsonl
└─────────────────────────┘
```

---

## 3. Modular Subsystems & Responsibilities

### 3.1 Ingestion Subsystem (`src/ingestion/`)
- **`base.py`**:
  - Implements resilient streaming HTTP downloaders with automatic retry loops (`urllib3.util.Retry`), custom User-Agents, and SSL session pooling.
  - Non-destructive caching: verifies existing file size before triggering redundant transfers.
  - Chunked streams prevent out-of-memory errors on multi-gigabyte planetary rasters.
  - Safe error recovery: removes partial artifacts on failed or interrupted downloads.
- **`pds.py`**:
  - Interacts with the NASA PDS Geosciences Node at Washington University in St. Louis.
  - Downloads binary raster products (`.IMG`) along with their detached metadata labels (`.LBL`).
- **`earthdata.py`**:
  - Manages NASA Earthdata Login (URS) authentication cookies and HTTP session redirects.
  - Integrates with NASA LP DAAC endpoints for SRTM and MODIS data streams.
- **`nasa_api.py`**:
  - Interacts with NASA Common Metadata Repository (CMR) REST API for automated granule search and spatial discovery.
  - Handles `api.nasa.gov` endpoints with exponential backoff and rate-limit detection.

### 3.2 Processing Subsystem (`src/processing/`)
- **`pds_reader.py`**:
  - Native Python PDS3 label parser and binary image extractor without heavy external C-dependencies.
  - Supports Big-Endian signed 16-bit integers (`MSB_INTEGER`), applies multiplicative scaling factors and additive offsets, and masks invalid or missing nodata pixels.
- **`terrain.py`**:
  - Planetary terrain analysis tools:
    - `compute_slope_degrees()`: Calculates local surface inclination via central gradient difference methods.
    - `compute_roughness_tri()`: Derives Wilson et al. Terrain Ruggedness Index (TRI).
    - `pixel_size_meters()`: Calculates physical ground pixel dimensions across different planetary bodies (Earth: 6371.0 km, Mars: 3389.5 km, Moon: 1737.4 km) based on latitude.
    - `extract_region()`: Subsets geographic bounding boxes from global planetary grids.
- **`cleaner.py`**:
  - Snake-case column normalizer.
  - Multi-tier QA flagger (`qa_flag`):
    - `0`: Valid observation.
    - `1`: One or more missing parameters.
    - `2`: Out-of-bounds spatial coordinates (`lat < -90 or > 90`, `lon < -180 or > 180`).
    - `3`: Duplicate record detected.
    - `9`: Greater than 50% attributes missing.
- **`sample_builder.py`**:
  - Exports compact, lightweight tabular samples (CSV), numpy binary grids (`.npy`), and statistical JSON summaries (`.json`).
  - Auto-generates plug-and-play Python loading scripts tailored for downstream consumers.

### 3.3 Validation Subsystem (`src/validation/`)
- **`validators.py`**:
  - Validates `config/settings.json` and `config/datasets.json` against operational schemas.
  - Confirms physical existence, non-zero file sizes, and tabular column consistency.
  - Generates machine-readable `reports/validation_report.json` and audit logs.

### 3.4 Provenance Subsystem (`src/provenance/`)
- **`tracker.py`**:
  - Maintains `reports/provenance.jsonl`.
  - Records ISO 8601 UTC timestamps, host system architecture, executed pipeline stages, source download URLs, target file sizes, and execution status.

---

## 4. Directory Structure & Data Segregation

The repository strictly isolates configuration, code, raw data, intermediate caches, processed artifacts, and sample distributions:

```
nasa-data-pipeline/
├── config/
│   ├── datasets.json            # Dataset definitions, URLs, access methods, schemas
│   └── settings.json            # Pipeline configuration, ROIs, download limits, focus areas
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
│   └── test_pipeline.py         # Pytest test suite covering all modules and edge cases
├── .env.example                 # Template for NASA Earthdata and API credentials
├── .gitignore                   # Excludes heavy raw rasters, secrets, and temp caches
├── README.md                    # Project overview, quickstart, and execution guide
└── requirements.txt             # Locked Python package dependencies
```

---

## 5. Idempotency, Caching & Error Handling

1. **Idempotency**: All download and generation routines can be executed repeatedly without side effects. If an output file exists and is non-empty, the system verifies its integrity and skips re-downloading unless explicitly forced (`--force`).
2. **Graceful Network Degradation**: If external servers return HTTP 403, 404, 429, or 500, the pipeline catches errors, logs the failure with source diagnostic codes, leaves the remaining pipeline operational, and records the event in the validation report.
3. **No Uncredentialed Assumptions**: The pipeline separates unauthenticated open data (NASA PDS LOLA and MOLA) from authenticated data (NASA Earthdata SRTM/MODIS). When credentials are not provided in `.env`, the system produces a clearly identified synthetic analogue sample so downstream development is never blocked.
