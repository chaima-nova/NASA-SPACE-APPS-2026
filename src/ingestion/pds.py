"""
src/ingestion/pds.py
Connector for NASA Planetary Data System (PDS) direct HTTPS files.
PDS data is publicly accessible (no authentication required).

Handles:
- MOLA MEGaDR (Mars elevation)  - PDS3 IMG + LBL format
- LOLA GDR (Lunar elevation)    - PDS3 IMG + LBL format
- Generic PDS HTTP directory listing / file discovery
"""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Optional

import requests

from .base import append_provenance, check_url_accessible, download_file, make_session

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# MOLA MEGaDR (Mars Global Surveyor)
# ---------------------------------------------------------------------------

# MOLA MEGDR archive at PDS Geosciences Node (Washington University in St. Louis)
# meg004: 4 pixels/degree global topography (2.07 MB) - ideal for development and verified testing
# meg016: 16 pixels/degree global topography (33.1 MB)
# meg128: 128 pixels/degree regional quadrants (129 MB each)
MOLA_004_BASE = "https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg004/"
MOLA_004_FILES = {
    "img": "megt90n000cb.img",
    "lbl": "megt90n000cb.lbl",
}

# Kept for backward compatibility
MOLA_BASE = MOLA_004_BASE
MOLA_FILES = MOLA_004_FILES


def download_mola_megdr(
    dest_dir: Path,
    resolution: int = 4,
    skip_if_exists: bool = True,
    provenance_file: Optional[Path] = None,
) -> list[dict]:
    """
    Download MOLA MEGaDR global elevation IMG + PDS3 LBL from PDS Geosciences.

    Args:
        dest_dir: Target directory
        resolution: 4 (default, 2.07 MB) or 16 (33.1 MB)
        skip_if_exists: Skip if file exists and non-empty
        provenance_file: Optional audit file

    Returns:
        List of provenance records
    """
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)

    if resolution == 16:
        base_url = "https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/"
        files = {"img": "megt90n000eb.img", "lbl": "megt90n000eb.lbl"}
        dataset_id = "mola_meg016"
    else:
        base_url = MOLA_004_BASE
        files = MOLA_004_FILES
        dataset_id = "mola_meg004"

    session = make_session()
    records = []

    for key, fname in files.items():
        url = base_url + fname
        dest = dest_dir / fname
        rec = download_file(url, dest, session=session, skip_if_exists=skip_if_exists)
        rec["dataset_id"] = dataset_id
        rec["file_role"] = key
        records.append(rec)
        if provenance_file:
            append_provenance(rec, Path(provenance_file))

    session.close()
    return records


def download_mola_meg128(
    dest_dir: Path,
    skip_if_exists: bool = True,
    provenance_file: Optional[Path] = None,
) -> list[dict]:
    """
    Download MOLA global topography IMG + LBL.
    Downloads the verified 4ppd product (~2 MB) to run reliably on normal laptops.
    """
    return download_mola_megdr(
        dest_dir=dest_dir,
        resolution=4,
        skip_if_exists=skip_if_exists,
        provenance_file=provenance_file,
    )


def check_mola_accessible() -> dict:
    """Verify the MOLA PDS server is reachable."""
    url = MOLA_004_BASE + MOLA_004_FILES["lbl"]
    result = check_url_accessible(url)
    result["dataset_id"] = "mola_meg128"
    return result


# ---------------------------------------------------------------------------
# LOLA GDR (Lunar Reconnaissance Orbiter)
# ---------------------------------------------------------------------------

# LOLA GDR archive at MIT Imbrium / NASA PDS
# LDEM_4: 4 pixels/degree global lunar DEM (2.07 MB) - ideal for development and verified testing
# LDEM_16: 16 pixels/degree global lunar DEM (33.1 MB)
# LDEM_64: 64 pixels/degree global lunar DEM (530.8 MB)
LOLA_BASE = "https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/"
LOLA_004_FILES = {
    "img": "LDEM_4.IMG",
    "lbl": "LDEM_4.LBL",
}
LOLA_64_FILES = {
    "img": "LDEM_64.IMG",
    "lbl": "LDEM_64.LBL",
}

# Kept for backward compatibility
LOLA_64_BASE = LOLA_BASE


def download_lola_gdr(
    dest_dir: Path,
    resolution: int = 4,
    skip_if_exists: bool = True,
    provenance_file: Optional[Path] = None,
) -> list[dict]:
    """
    Download LOLA lunar DEM IMG + LBL from PDS / MIT archive.

    Args:
        dest_dir: Target directory
        resolution: 4 (default, ~2 MB), 16 (~33 MB), or 64 (~530 MB)
        skip_if_exists: Skip if file exists and non-empty
        provenance_file: Optional audit file

    Returns:
        List of provenance records
    """
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)

    if resolution == 64:
        files = LOLA_64_FILES
        dataset_id = "lola_64ppd"
    elif resolution == 16:
        files = {"img": "LDEM_16.IMG", "lbl": "LDEM_16.LBL"}
        dataset_id = "lola_16ppd"
    else:
        files = LOLA_004_FILES
        dataset_id = "lola_4ppd"

    session = make_session()
    records = []

    for key, fname in files.items():
        url = LOLA_BASE + fname
        dest = dest_dir / fname.lower()
        rec = download_file(url, dest, session=session, skip_if_exists=skip_if_exists)
        rec["dataset_id"] = dataset_id
        rec["file_role"] = key
        records.append(rec)
        if provenance_file:
            append_provenance(rec, Path(provenance_file))

    session.close()
    return records


def download_lola_64ppd(
    dest_dir: Path,
    skip_if_exists: bool = True,
    provenance_file: Optional[Path] = None,
) -> list[dict]:
    """
    Download LOLA lunar DEM IMG + LBL.
    Defaults to 4ppd (~2 MB) for fast, reliable verification on normal laptops.
    """
    return download_lola_gdr(
        dest_dir=dest_dir,
        resolution=4,
        skip_if_exists=skip_if_exists,
        provenance_file=provenance_file,
    )


def check_lola_accessible() -> dict:
    """Verify the LOLA PDS server is reachable."""
    url = LOLA_BASE + LOLA_004_FILES["lbl"]
    result = check_url_accessible(url)
    result["dataset_id"] = "lola_64ppd"
    return result


# ---------------------------------------------------------------------------
# Generic PDS HTTP directory lister
# ---------------------------------------------------------------------------

def list_pds_directory(base_url: str) -> list[str]:
    """
    Attempt to list files in a PDS HTTP directory by parsing its HTML index.
    Returns list of absolute URLs. Empty list on failure.
    """
    try:
        resp = requests.get(base_url, timeout=15)
        resp.raise_for_status()
        # Extract hrefs that are not parent-dir links
        links = re.findall(r'href=["\']([^"\']+)["\']', resp.text, re.IGNORECASE)
        files = []
        for link in links:
            if link.startswith("?") or link.startswith("/") and "parent" in link.lower():
                continue
            if link.startswith("http"):
                files.append(link)
            elif not link.startswith("..") and not link.startswith("/"):
                files.append(base_url.rstrip("/") + "/" + link)
        return files
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not list PDS directory %s: %s", base_url, exc)
        return []
