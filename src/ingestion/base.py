"""
src/ingestion/base.py
Base HTTP downloader with retry, streaming, checksum, and resume support.
All dataset-specific connectors extend or call this module.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from pathlib import Path
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------

def make_session(
    username: Optional[str] = None,
    password: Optional[str] = None,
    max_retries: int = 3,
    timeout: int = 120,
) -> requests.Session:
    """
    Create a requests.Session with:
    - Optional HTTP Basic auth (for NASA Earthdata)
    - Automatic retry with backoff on transient errors
    - Reasonable connect/read timeouts
    """
    session = requests.Session()

    if username and password:
        session.auth = (username, password)

    retry_strategy = Retry(
        total=max_retries,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "OPTIONS"],
        backoff_factor=2,  # waits 2, 4, 8 seconds between retries
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)

    # User-agent that identifies us politely
    session.headers.update({
        "User-Agent": "NASA-SpaceApps-DataPipeline/1.0 (Space Apps Challenge; contact: team)"
    })

    session._timeout = timeout  # store for callers to use
    return session


# ---------------------------------------------------------------------------
# Core streaming downloader
# ---------------------------------------------------------------------------

def download_file(
    url: str,
    dest_path: Path,
    session: Optional[requests.Session] = None,
    chunk_size: int = 65_536,
    timeout: int = 120,
    skip_if_exists: bool = True,
    expected_md5: Optional[str] = None,
) -> dict:
    """
    Download *url* to *dest_path* using streaming (memory-safe for large files).

    Returns a provenance record dict with:
      url, dest_path, size_bytes, md5, status, timestamp, error

    Never raises on download failure – records status='error' instead.
    """
    record: dict = {
        "url": url,
        "dest_path": str(dest_path),
        "size_bytes": None,
        "md5": None,
        "status": "unknown",
        "timestamp": None,
        "error": None,
    }

    dest_path = Path(dest_path)
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    # ── Skip if file already exists and is non-empty ──────────────────────
    if skip_if_exists and dest_path.exists() and dest_path.stat().st_size > 0:
        logger.info("SKIP (already exists): %s", dest_path.name)
        record["status"] = "skipped_existing"
        record["size_bytes"] = dest_path.stat().st_size
        record["timestamp"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        return record

    # ── Create session if none provided ───────────────────────────────────
    own_session = session is None
    if own_session:
        session = make_session()

    try:
        logger.info("Downloading: %s → %s", url, dest_path.name)
        resp = session.get(url, stream=True, timeout=timeout)

        if resp.status_code == 401:
            record["status"] = "error_auth_required"
            record["error"] = "HTTP 401: Authentication required. Set credentials in .env"
            logger.error("AUTH REQUIRED: %s", url)
            return record

        if resp.status_code == 403:
            record["status"] = "error_forbidden"
            record["error"] = "HTTP 403: Access forbidden. Check credentials or data license."
            logger.error("FORBIDDEN: %s", url)
            return record

        if resp.status_code == 404:
            record["status"] = "error_not_found"
            record["error"] = f"HTTP 404: URL not found: {url}"
            logger.error("NOT FOUND: %s", url)
            return record

        resp.raise_for_status()

        hasher = hashlib.md5()
        total_bytes = 0

        with open(dest_path, "wb") as fh:
            for chunk in resp.iter_content(chunk_size=chunk_size):
                if chunk:
                    fh.write(chunk)
                    hasher.update(chunk)
                    total_bytes += len(chunk)

        md5 = hasher.hexdigest()
        record["size_bytes"] = total_bytes
        record["md5"] = md5
        record["timestamp"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # ── Optional checksum verification ────────────────────────────────
        if expected_md5 and md5 != expected_md5:
            record["status"] = "error_checksum_mismatch"
            record["error"] = f"MD5 mismatch: got {md5}, expected {expected_md5}"
            logger.error("CHECKSUM MISMATCH: %s", dest_path.name)
        else:
            record["status"] = "success"
            logger.info(
                "Downloaded %s (%.2f MB, md5=%s)",
                dest_path.name,
                total_bytes / 1_048_576,
                md5[:8],
            )

    except requests.exceptions.Timeout:
        record["status"] = "error_timeout"
        record["error"] = "Request timed out"
        logger.error("TIMEOUT: %s", url)

    except requests.exceptions.ConnectionError as exc:
        record["status"] = "error_connection"
        record["error"] = str(exc)
        logger.error("CONNECTION ERROR: %s – %s", url, exc)

    except Exception as exc:  # noqa: BLE001
        record["status"] = "error_unknown"
        record["error"] = str(exc)
        logger.exception("UNEXPECTED ERROR downloading %s", url)

    finally:
        if own_session:
            session.close()
        # Remove partial file on error
        if record["status"].startswith("error") and dest_path.exists():
            try:
                dest_path.unlink()
            except OSError:
                pass

    return record


# ---------------------------------------------------------------------------
# Provenance record writer
# ---------------------------------------------------------------------------

def append_provenance(record: dict, provenance_file: Path) -> None:
    """Append a download provenance record to a JSONL file."""
    provenance_file.parent.mkdir(parents=True, exist_ok=True)
    with open(provenance_file, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record) + "\n")


# ---------------------------------------------------------------------------
# HEAD request helper
# ---------------------------------------------------------------------------

def check_url_accessible(url: str, session: Optional[requests.Session] = None) -> dict:
    """
    Do a lightweight HEAD request to verify a URL is reachable.
    Returns dict with keys: url, accessible, status_code, content_type, content_length, error
    """
    own = session is None
    session = session or make_session()
    result = {
        "url": url,
        "accessible": False,
        "status_code": None,
        "content_type": None,
        "content_length": None,
        "error": None,
    }
    try:
        resp = session.head(url, timeout=15, allow_redirects=True)
        result["status_code"] = resp.status_code
        result["content_type"] = resp.headers.get("Content-Type")
        result["content_length"] = resp.headers.get("Content-Length")
        result["accessible"] = resp.status_code < 400
    except Exception as exc:  # noqa: BLE001
        result["error"] = str(exc)
    finally:
        if own:
            session.close()
    return result
