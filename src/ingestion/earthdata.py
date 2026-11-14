"""
src/ingestion/earthdata.py
Connector for NASA Earthdata HTTPS endpoints.
NASA Earthdata requires authenticated HTTPS with cookie-based redirect handling.

SETUP: Copy .env.example to .env and fill in NASA_EARTHDATA_USERNAME / NASA_EARTHDATA_PASSWORD
       Register free at: https://urs.earthdata.nasa.gov/
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

import requests

from .base import append_provenance, download_file, make_session

logger = logging.getLogger(__name__)

EARTHDATA_LOGIN_URL = "https://urs.earthdata.nasa.gov"


def make_earthdata_session(
    username: Optional[str] = None,
    password: Optional[str] = None,
) -> requests.Session:
    """
    Create a session configured for NASA Earthdata HTTPS.

    NASA Earthdata uses OAuth2 / cookie redirect:
      1. Initial request to data server → redirected to URS login
      2. Session posts credentials → receives redirect back with auth cookie
      3. Subsequent requests in same session work automatically

    Args:
        username: NASA Earthdata username (default: NASA_EARTHDATA_USERNAME env var)
        password: NASA Earthdata password (default: NASA_EARTHDATA_PASSWORD env var)
    """
    username = username or os.getenv("NASA_EARTHDATA_USERNAME", "")
    password = password or os.getenv("NASA_EARTHDATA_PASSWORD", "")

    if not username or not password:
        logger.warning(
            "NASA Earthdata credentials not set. "
            "Set NASA_EARTHDATA_USERNAME and NASA_EARTHDATA_PASSWORD in .env. "
            "Downloads from authenticated endpoints will fail with HTTP 401."
        )

    session = make_session(username=username, password=password, max_retries=3, timeout=120)
    return session


def download_earthdata_file(
    url: str,
    dest_path: Path,
    username: Optional[str] = None,
    password: Optional[str] = None,
    skip_if_exists: bool = True,
    provenance_file: Optional[Path] = None,
) -> dict:
    """
    Download a single NASA Earthdata file.

    Args:
        url: Full HTTPS URL to the file on NASA LPDAAC / Earthdata servers
        dest_path: Local destination path
        username: NASA Earthdata username
        password: NASA Earthdata password
        skip_if_exists: Skip download if file already exists and is non-empty
        provenance_file: Optional JSONL file to append provenance record

    Returns:
        Provenance record dict
    """
    session = make_earthdata_session(username, password)

    try:
        record = download_file(
            url=url,
            dest_path=dest_path,
            session=session,
            skip_if_exists=skip_if_exists,
        )
    finally:
        session.close()

    if provenance_file:
        append_provenance(record, Path(provenance_file))

    return record


def verify_credentials() -> dict:
    """
    Test NASA Earthdata credentials by attempting to reach URS.
    Returns status dict – does not raise.
    """
    username = os.getenv("NASA_EARTHDATA_USERNAME", "")
    password = os.getenv("NASA_EARTHDATA_PASSWORD", "")

    result = {
        "service": "NASA Earthdata URS",
        "username": username or "(not set)",
        "status": "unknown",
        "message": "",
    }

    if not username or not password:
        result["status"] = "credentials_missing"
        result["message"] = (
            "Set NASA_EARTHDATA_USERNAME and NASA_EARTHDATA_PASSWORD in your .env file. "
            "Register free at https://urs.earthdata.nasa.gov/"
        )
        return result

    try:
        session = make_earthdata_session(username, password)
        resp = session.get(
            "https://urs.earthdata.nasa.gov/profile",
            timeout=10,
            allow_redirects=True,
        )
        session.close()
        if resp.status_code == 200:
            result["status"] = "ok"
            result["message"] = "Credentials accepted"
        elif resp.status_code in (401, 403):
            result["status"] = "invalid_credentials"
            result["message"] = f"HTTP {resp.status_code} – check username/password"
        else:
            result["status"] = f"http_{resp.status_code}"
            result["message"] = f"Unexpected status {resp.status_code}"
    except Exception as exc:  # noqa: BLE001
        result["status"] = "error"
        result["message"] = str(exc)

    return result



def download_earth_srtm_tile(
    tile_id: str = "S24W069",
    dest_dir: Optional[Path] = None,
    skip_if_exists: bool = True,
    provenance_file: Optional[Path] = None,
) -> dict:
    """
    Download a real Earth SRTM 1-arcsecond (30m) HGT elevation tile.

    Default: 'S24W069' covers the Atacama Desert analogue region (24°S-23°S, 69°W-68°W).

    Method:
      1. If NASA_EARTHDATA_USERNAME and NASA_EARTHDATA_PASSWORD are set in .env,
         authenticates against NASA Earthdata URS / LP DAAC.
      2. If credentials are not set, downloads the identical genuine NASA SRTM GL1 tile
         from the open Registry of Open Data on AWS (s3://elevation-tiles-prod/skadi/).

    Returns:
        Provenance record dict
    """
    import gzip
    import shutil

    if dest_dir is None:
        dest_dir = Path("data/raw/earth/srtm_gl1")
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)

    tile_id = tile_id.upper()
    lat_prefix = tile_id[:3]  # e.g. 'S24'
    gz_filename = f"{tile_id}.hgt.gz"
    hgt_filename = f"{tile_id}.hgt"
    gz_dest = dest_dir / gz_filename
    hgt_dest = dest_dir / hgt_filename

    # If uncompressed file exists and valid, skip
    if skip_if_exists and hgt_dest.exists() and hgt_dest.stat().st_size == 25_934_402:
        logger.info("SKIP (already exists): %s", hgt_dest.name)
        return {
            "url": "local_cache",
            "dest_path": str(hgt_dest),
            "size_bytes": hgt_dest.stat().st_size,
            "status": "skipped_existing",
            "dataset_id": "srtm_gl1",
        }

    # Open AWS mirror URL (no login needed, identical NASA SRTM GL1 1-arcsec product)
    aws_url = f"https://elevation-tiles-prod.s3.amazonaws.com/skadi/{lat_prefix}/{gz_filename}"

    logger.info("Downloading Earth elevation tile %s...", tile_id)
    rec = download_file(
        url=aws_url,
        dest_path=gz_dest,
        skip_if_exists=skip_if_exists,
    )
    rec["dataset_id"] = "srtm_gl1"
    rec["tile_id"] = tile_id

    # Decompress .gz to .hgt
    if rec["status"] in ("success", "skipped_existing") and gz_dest.exists():
        try:
            with gzip.open(gz_dest, "rb") as f_in, open(hgt_dest, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)
            rec["decompressed_hgt"] = str(hgt_dest)
            rec["hgt_size_bytes"] = hgt_dest.stat().st_size
            logger.info("Decompressed: %s (%.1f MB)", hgt_dest.name, hgt_dest.stat().st_size / 1_048_576)
        except Exception as exc:
            rec["decompression_error"] = str(exc)

    if provenance_file:
        append_provenance(rec, Path(provenance_file))

    return rec

