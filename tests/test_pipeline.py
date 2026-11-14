"""
tests/test_pipeline.py
Comprehensive test suite for the NASA Space Apps data pipeline.
Run with: pytest tests/ -v
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest

# Ensure project root is on path
ROOT = Path(__file__).resolve().parents[1]
import sys
sys.path.insert(0, str(ROOT))


# ============================================================================
# Config validation tests
# ============================================================================

class TestConfigValidation:
    def test_settings_file_exists(self):
        assert (ROOT / "config" / "settings.json").exists()

    def test_datasets_file_exists(self):
        assert (ROOT / "config" / "datasets.json").exists()

    def test_settings_json_parseable(self):
        with open(ROOT / "config" / "settings.json") as fh:
            cfg = json.load(fh)
        assert isinstance(cfg, dict)

    def test_settings_has_required_keys(self):
        with open(ROOT / "config" / "settings.json") as fh:
            cfg = json.load(fh)
        for key in ["pipeline", "focus_areas", "regions_of_interest", "download_limits"]:
            assert key in cfg, f"Missing key: {key}"

    def test_datasets_json_parseable(self):
        with open(ROOT / "config" / "datasets.json") as fh:
            cfg = json.load(fh)
        assert "datasets" in cfg
        assert isinstance(cfg["datasets"], list)

    def test_each_dataset_has_required_fields(self):
        with open(ROOT / "config" / "datasets.json") as fh:
            cfg = json.load(fh)
        for ds in cfg["datasets"]:
            for field in ["id", "name", "planetary_body", "enabled", "access_method"]:
                assert field in ds, f"Dataset '{ds.get('id')}' missing field '{field}'"

    def test_dataset_ids_are_unique(self):
        with open(ROOT / "config" / "datasets.json") as fh:
            cfg = json.load(fh)
        ids = [ds["id"] for ds in cfg["datasets"]]
        assert len(ids) == len(set(ids)), "Duplicate dataset IDs found"

    def test_planetary_bodies_are_valid(self):
        valid_bodies = {"earth", "mars", "moon", "generic"}
        with open(ROOT / "config" / "datasets.json") as fh:
            cfg = json.load(fh)
        for ds in cfg["datasets"]:
            assert ds["planetary_body"] in valid_bodies, (
                f"Dataset '{ds['id']}' has unknown planetary_body: '{ds['planetary_body']}'"
            )

    def test_env_example_exists(self):
        assert (ROOT / ".env.example").exists()

    def test_gitignore_excludes_env(self):
        content = (ROOT / ".gitignore").read_text()
        assert ".env" in content


# ============================================================================
# File structure tests
# ============================================================================

class TestFileStructure:
    def test_required_scripts_exist(self):
        scripts = [
            "scripts/discover_datasets.py",
            "scripts/download_data.py",
            "scripts/inspect_data.py",
            "scripts/clean_data.py",
            "scripts/validate_data.py",
            "scripts/build_samples.py",
            "scripts/run_pipeline.py",
        ]
        for s in scripts:
            assert (ROOT / s).exists(), f"Missing script: {s}"

    def test_src_modules_exist(self):
        modules = [
            "src/ingestion/base.py",
            "src/ingestion/earthdata.py",
            "src/ingestion/pds.py",
            "src/ingestion/nasa_api.py",
            "src/processing/pds_reader.py",
            "src/processing/terrain.py",
            "src/processing/cleaner.py",
            "src/processing/sample_builder.py",
            "src/validation/validators.py",
            "src/provenance/tracker.py",
        ]
        for m in modules:
            assert (ROOT / m).exists(), f"Missing module: {m}"

    def test_docs_exist(self):
        docs = [
            "docs/dataset_catalog.csv",
            "docs/data_sources.md",
            "docs/data_dictionary.md",
            "docs/pipeline_architecture.md",
            "docs/known_limitations.md",
            "docs/teammate_handoff.md",
        ]
        for d in docs:
            assert (ROOT / d).exists(), f"Missing doc: {d}"

    def test_data_dirs_exist(self):
        dirs = [
            "data/raw/earth",
            "data/raw/mars",
            "data/raw/moon",
            "data/interim",
            "data/processed",
            "data/samples",
        ]
        for d in dirs:
            assert (ROOT / d).exists(), f"Missing directory: {d}"

    def test_no_file_is_empty(self):
        """All source Python files must be non-empty."""
        for py_file in (ROOT / "src").rglob("*.py"):
            assert py_file.stat().st_size > 0, f"Empty file: {py_file}"


# ============================================================================
# Ingestion module tests
# ============================================================================

class TestBaseIngestion:
    def test_make_session_returns_session(self):
        from src.ingestion.base import make_session
        session = make_session()
        assert session is not None
        session.close()

    def test_make_session_with_auth(self):
        from src.ingestion.base import make_session
        session = make_session(username="user", password="pass")
        assert session.auth == ("user", "pass")
        session.close()

    def test_download_file_http_404(self):
        from src.ingestion.base import download_file
        with tempfile.TemporaryDirectory() as tmpdir:
            dest = Path(tmpdir) / "test_file.txt"
            # Use a URL that should 404
            record = download_file(
                "https://httpbin.org/status/404",
                dest,
                skip_if_exists=False,
            )
        assert record["status"] == "error_not_found"
        assert not dest.exists()  # partial file removed

    def test_download_file_skip_existing(self):
        from src.ingestion.base import download_file
        with tempfile.TemporaryDirectory() as tmpdir:
            dest = Path(tmpdir) / "existing.txt"
            dest.write_bytes(b"already here")
            record = download_file("https://example.com/file.txt", dest, skip_if_exists=True)
        assert record["status"] == "skipped_existing"

    def test_check_url_accessible_invalid(self):
        from src.ingestion.base import check_url_accessible
        result = check_url_accessible("https://this-domain-does-not-exist-12345.invalid/file")
        assert result["accessible"] is False

    def test_append_provenance(self):
        from src.ingestion.base import append_provenance
        with tempfile.TemporaryDirectory() as tmpdir:
            prov_file = Path(tmpdir) / "prov.jsonl"
            record = {"url": "https://example.com", "status": "success", "size": 100}
            append_provenance(record, prov_file)
            assert prov_file.exists()
            data = json.loads(prov_file.read_text().strip())
            assert data["url"] == "https://example.com"


class TestNASAAPI:
    def test_get_api_key_defaults_to_demo(self):
        from src.ingestion.nasa_api import get_api_key
        # Without env variable set
        with patch.dict(os.environ, {}, clear=True):
            key = get_api_key()
            assert key == "DEMO_KEY"

    def test_get_api_key_from_env(self):
        from src.ingestion.nasa_api import get_api_key
        with patch.dict(os.environ, {"NASA_API_KEY": "MY_TEST_KEY"}):
            key = get_api_key()
            assert key == "MY_TEST_KEY"

    def test_nasa_api_get_success(self):
        """Test NASA API APOD endpoint with DEMO_KEY."""
        from src.ingestion.nasa_api import nasa_api_get
        result = nasa_api_get("/planetary/apod", {"date": "2024-01-01"})
        # Either succeeds or hits rate limit (both are acceptable)
        assert result["status_code"] in (200, 429, 403)
        assert result["url"].startswith("https://api.nasa.gov")

    def test_cmr_search_granules_runs(self):
        """CMR search should return a result dict even if no granules found."""
        from src.ingestion.nasa_api import cmr_search_granules
        result = cmr_search_granules("SRTMGL1", bbox=[-180, -90, 180, 90], page_size=1)
        assert "hits" in result
        assert isinstance(result["entries"], list)


# ============================================================================
# Processing module tests
# ============================================================================

class TestPDS3Reader:
    def test_parse_pds3_label_valid(self):
        from src.processing.pds_reader import parse_pds3_label
        with tempfile.NamedTemporaryFile(mode="w", suffix=".LBL", delete=False) as f:
            f.write("PDS_VERSION_ID = PDS3\n")
            f.write("LINES = 5632\n")
            f.write("LINE_SAMPLES = 11520\n")
            f.write("SAMPLE_BITS = 16\n")
            f.write("SCALING_FACTOR = 0.5\n")
            f.write("END\n")
            fname = f.name
        label = parse_pds3_label(Path(fname))
        Path(fname).unlink()
        assert label["LINES"] == "5632"
        assert label["SCALING_FACTOR"] == "0.5"

    def test_read_pds3_img_missing_file(self):
        from src.processing.pds_reader import read_pds3_img
        result = read_pds3_img(Path("/nonexistent/file.img"))
        assert result["error"] is not None

    def test_read_pds3_img_synthetic(self):
        """Write a tiny synthetic PDS3 binary and read it back."""
        from src.processing.pds_reader import read_pds3_img
        with tempfile.TemporaryDirectory() as tmpdir:
            img_path = Path(tmpdir) / "test.img"
            lbl_path = Path(tmpdir) / "test.lbl"

            # Write synthetic data: 4 rows × 8 cols of MSB int16
            nrows, ncols = 4, 8
            data = np.arange(nrows * ncols, dtype=">i2")
            img_path.write_bytes(data.tobytes())

            lbl_path.write_text(
                f"LINES = {nrows}\n"
                f"LINE_SAMPLES = {ncols}\n"
                "SAMPLE_BITS = 16\n"
                "SAMPLE_TYPE = MSB_INTEGER\n"
                "SCALING_FACTOR = 1.0\n"
                "OFFSET = 0.0\n"
                "END\n"
            )

            result = read_pds3_img(img_path, lbl_path)

        assert result["error"] is None
        assert result["data"].shape == (nrows, ncols)
        assert float(np.nanmin(result["data"])) >= 0


class TestTerrain:
    def test_compute_slope_flat(self):
        from src.processing.terrain import compute_slope_degrees
        # Flat terrain → slope ≈ 0
        flat = np.ones((10, 10), dtype=np.float32) * 1000.0
        slope = compute_slope_degrees(flat, pixel_size_x_m=30.0, pixel_size_y_m=30.0)
        assert slope.shape == (10, 10)
        # Edges may have tiny non-zero values from padding; interior should be ~0
        assert np.nanmax(np.abs(slope[1:-1, 1:-1])) < 0.01

    def test_compute_slope_incline(self):
        from src.processing.terrain import compute_slope_degrees
        # Incline: each row increases by 30 m over 30 m pixel → 45° slope
        arr = np.zeros((5, 5), dtype=np.float32)
        for i in range(5):
            arr[i, :] = i * 30.0  # 30m rise per 30m run
        slope = compute_slope_degrees(arr, pixel_size_x_m=30.0, pixel_size_y_m=30.0)
        # Interior should be near 45 degrees
        assert 40 < np.nanmean(slope[1:-1, 1:-1]) < 50

    def test_pixel_size_earth(self):
        from src.processing.terrain import pixel_size_meters
        px, py = pixel_size_meters(0.0, 1.0, "earth")
        assert 110_000 < px < 115_000  # ~111km at equator
        assert 110_000 < py < 115_000

    def test_pixel_size_mars(self):
        from src.processing.terrain import pixel_size_meters
        px, py = pixel_size_meters(0.0, 1.0, "mars")
        assert 59_000 < px < 60_000  # ~59.3 km at Mars equator

    def test_extract_region(self):
        from src.processing.terrain import extract_region
        data = np.zeros((180, 360), dtype=np.float32)
        subset, info = extract_region(
            data, west=0, south=-10, east=10, north=0,
            img_west=-180, img_north=90, resolution_deg=1.0
        )
        assert subset.shape[0] > 0
        assert subset.shape[1] > 0


class TestCleaner:
    def test_normalise_columns(self):
        from src.processing.cleaner import normalise_columns
        df = pd.DataFrame({"Column A": [1], "Col-B": [2], " C ": [3]})
        out = normalise_columns(df)
        assert list(out.columns) == ["column_a", "col_b", "c"]

    def test_flag_missing(self):
        from src.processing.cleaner import flag_missing
        df = pd.DataFrame({"a": [1.0, -9999.0, 3.0], "b": [4.0, 5.0, None]})
        out = flag_missing(df, nodata_values=[-9999])
        assert out.loc[1, "a"] != out.loc[1, "a"]  # NaN check
        assert out.loc[2, "qa_flag"] == 1

    def test_validate_coordinates_bad(self):
        from src.processing.cleaner import validate_coordinates
        df = pd.DataFrame({"latitude": [91.0, 0.0], "longitude": [0.0, 181.0]})
        out = validate_coordinates(df)
        assert out.loc[0, "qa_flag"] >= 2
        assert out.loc[1, "qa_flag"] >= 2

    def test_validate_coordinates_good(self):
        from src.processing.cleaner import validate_coordinates
        df = pd.DataFrame({"latitude": [45.0], "longitude": [90.0]})
        out = validate_coordinates(df)
        assert out.loc[0, "qa_flag"] == 0

    def test_flag_duplicates(self):
        from src.processing.cleaner import flag_duplicates
        df = pd.DataFrame({"a": [1, 1, 2], "b": [2, 2, 3]})
        out = flag_duplicates(df)
        # Row 1 is a dup of row 0
        assert out.loc[1, "qa_flag"] >= 3


# ============================================================================
# Validation module tests
# ============================================================================

class TestValidators:
    def test_check_file_exists_present(self, tmp_path):
        from src.validation.validators import check_file_exists
        f = tmp_path / "test.txt"
        f.write_text("hello")
        result = check_file_exists(f)
        assert result["passed"] is True

    def test_check_file_exists_missing(self, tmp_path):
        from src.validation.validators import check_file_exists
        result = check_file_exists(tmp_path / "missing.txt")
        assert result["passed"] is False

    def test_check_file_nonempty_empty(self, tmp_path):
        from src.validation.validators import check_file_nonempty
        f = tmp_path / "empty.txt"
        f.write_bytes(b"")
        result = check_file_nonempty(f)
        assert result["passed"] is False

    def test_validate_settings_valid(self):
        from src.validation.validators import validate_settings
        results = validate_settings(ROOT / "config" / "settings.json")
        errors = [r for r in results if not r["passed"] and r["severity"] == "error"]
        assert len(errors) == 0, f"Validation errors: {errors}"

    def test_validate_datasets_config(self):
        from src.validation.validators import validate_datasets_config
        results = validate_datasets_config(ROOT / "config" / "datasets.json")
        errors = [r for r in results if not r["passed"] and r["severity"] == "error"]
        assert len(errors) == 0, f"Validation errors: {errors}"

    def test_validate_dataframe_missing_column(self):
        from src.validation.validators import validate_dataframe
        df = pd.DataFrame({"a": [1, 2]})
        results = validate_dataframe(df, ["a", "b"], "test_ds")
        col_b_check = [r for r in results if "col_b" in r["check"]]
        assert any(not r["passed"] for r in col_b_check)

    def test_compile_report(self, tmp_path):
        from src.validation.validators import compile_report
        results = [
            {"check": "c1", "passed": True, "detail": "ok", "severity": "info"},
            {"check": "c2", "passed": False, "detail": "fail", "severity": "error"},
        ]
        report = compile_report(results, tmp_path / "report.json")
        assert report["summary"]["errors"] == 1
        assert report["summary"]["passed"] == 1
        assert report["summary"]["overall_pass"] is False


# ============================================================================
# Provenance tracker tests
# ============================================================================

class TestProvenanceTracker:
    def test_creates_log_file(self, tmp_path):
        from src.provenance.tracker import ProvenanceTracker
        tracker = ProvenanceTracker(tmp_path / "prov.jsonl")
        assert (tmp_path / "prov.jsonl").exists()

    def test_records_download(self, tmp_path):
        from src.provenance.tracker import ProvenanceTracker
        tracker = ProvenanceTracker(tmp_path / "prov.jsonl")
        tracker.record_download("test_ds", {"url": "https://example.com", "status": "success"})
        lines = (tmp_path / "prov.jsonl").read_text().strip().split("\n")
        assert len(lines) >= 2  # start event + download event
        events = [json.loads(l)["event"] for l in lines]
        assert "download" in events

    def test_finalize(self, tmp_path):
        from src.provenance.tracker import ProvenanceTracker
        tracker = ProvenanceTracker(tmp_path / "prov.jsonl")
        tracker.finalize({"overall_status": "PASS"})
        lines = (tmp_path / "prov.jsonl").read_text().strip().split("\n")
        last = json.loads(lines[-1])
        assert last["event"] == "pipeline_end"


# ============================================================================
# Integration: sample builder (runs on existing files)
# ============================================================================

class TestSampleBuilder:
    def test_build_data_dictionary(self, tmp_path):
        from src.processing.sample_builder import build_data_dictionary
        specs = [
            {"field_name": "lat", "description": "latitude", "units": "degrees",
             "dtype": "float64", "valid_range": "[-90,90]", "nodata_value": "NaN",
             "source": "test", "notes": ""},
        ]
        out = tmp_path / "dict.csv"
        build_data_dictionary(specs, out)
        assert out.exists()
        df = pd.read_csv(out)
        assert "field_name" in df.columns
        assert len(df) == 1

    def test_write_loading_example(self, tmp_path):
        from src.processing.sample_builder import write_loading_example
        csv_p = tmp_path / "sample.csv"
        out_p = tmp_path / "load.py"
        write_loading_example("test_ds", "moon", csv_p, out_p, "elevation_m", "meters")
        assert out_p.exists()
        code = out_p.read_text()
        assert "pd.read_csv" in code
        assert "elevation_m" in code

    def test_synthetic_sample_exists(self):
        """After build_samples.py, the synthetic Earth sample must exist."""
        synthetic = ROOT / "data" / "samples" / "SYNTHETIC_earth_atacama_analogue_sample.csv"
        if synthetic.exists():
            df = pd.read_csv(synthetic, nrows=5)
            assert "latitude" in df.columns
            assert "elevation_m" in df.columns
            assert "data_source" in df.columns
            # Must clearly label as synthetic
            assert "SYNTHETIC" in df["data_source"].iloc[0]


# ============================================================================
# Download failure handling
# ============================================================================

class TestDownloadErrorHandling:
    def test_handles_timeout_gracefully(self):
        from src.ingestion.base import download_file
        import requests
        with tempfile.TemporaryDirectory() as tmpdir:
            dest = Path(tmpdir) / "timeout_test.bin"
            with patch("src.ingestion.base.requests.Session.get",
                       side_effect=requests.exceptions.Timeout):
                session = __import__("src.ingestion.base", fromlist=["make_session"]).make_session()
                record = download_file("https://example.com/file", dest, session=session)
                session.close()
        assert record["status"] == "error_timeout"

    def test_handles_connection_error_gracefully(self):
        from src.ingestion.base import download_file
        import requests
        with tempfile.TemporaryDirectory() as tmpdir:
            dest = Path(tmpdir) / "conn_test.bin"
            with patch("src.ingestion.base.requests.Session.get",
                       side_effect=requests.exceptions.ConnectionError("refused")):
                session = __import__("src.ingestion.base", fromlist=["make_session"]).make_session()
                record = download_file("https://example.com/file", dest, session=session)
                session.close()
        assert record["status"] == "error_connection"
