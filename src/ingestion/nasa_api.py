"""
src/ingestion/nasa_api.py
Connector for NASA Open APIs (api.nasa.gov).
Uses NASA_API_KEY from environment. Falls back to 'DEMO_KEY' if not set.
DEMO_KEY is rate-limited to 30 requests/hour and 50 requests/day.
Register for a free key at: https://api.nasa.gov/
"""
from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Optional

import requests

from .base import append_provenance, make_session

logger = logging.getLogger(__name__)

NASA_API_BASE = "https://api.nasa.gov"


def get_api_key() -> str:
    """Return NASA API key from environment, defaulting to DEMO_KEY."""
    key = os.getenv("NASA_API_KEY", "DEMO_KEY")
    if key == "DEMO_KEY":
        logger.info(
            "Using NASA API DEMO_KEY (rate limited). "
            "Set NASA_API_KEY in .env for higher limits. "
            "Register free at https://api.nasa.gov/"
        )
    return key


def nasa_api_get(
    endpoint: str,
    params: Optional[dict] = None,
    timeout: int = 30,
) -> dict:
    """
    Make an authenticated GET request to a NASA Open API endpoint.

    Args:
        endpoint: API path, e.g. '/planetary/apod'
        params: Additional query parameters

    Returns:
        Dict with keys: data (parsed JSON or None), status_code, error, url
    """
    api_key = get_api_key()
    query = {"api_key": api_key}
    if params:
        query.update(params)

    url = NASA_API_BASE.rstrip("/") + "/" + endpoint.lstrip("/")
    result = {"url": url, "data": None, "status_code": None, "error": None}

    session = make_session()
    try:
        resp = session.get(url, params=query, timeout=timeout)
        result["status_code"] = resp.status_code

        if resp.status_code == 429:
            result["error"] = "Rate limited (429). Wait or use a registered API key."
            logger.warning("NASA API rate limited on %s", endpoint)
        elif resp.status_code == 403:
            result["error"] = "API key invalid or quota exceeded (403)."
            logger.error("NASA API 403 on %s", endpoint)
        elif resp.ok:
            result["data"] = resp.json()
        else:
            result["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as exc:  # noqa: BLE001
        result["error"] = str(exc)
        logger.exception("NASA API request failed: %s", endpoint)
    finally:
        session.close()

    return result


# ---------------------------------------------------------------------------
# APOD – used as a connectivity and auth check
# ---------------------------------------------------------------------------

def fetch_apod(date: Optional[str] = None, dest_file: Optional[Path] = None) -> dict:
    """
    Fetch NASA Astronomy Picture of the Day metadata.

    Args:
        date: ISO date string 'YYYY-MM-DD'. Defaults to today.
        dest_file: Optional JSON file to write result.

    Returns:
        API response dict
    """
    params = {}
    if date:
        params["date"] = date

    result = nasa_api_get("/planetary/apod", params=params)

    if dest_file and result["data"]:
        dest_file = Path(dest_file)
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        with open(dest_file, "w", encoding="utf-8") as fh:
            json.dump(result["data"], fh, indent=2)
        logger.info("Saved APOD metadata to %s", dest_file)
        record = {
            "url": result["url"],
            "dest_path": str(dest_file),
            "status": "success" if result["data"] else "error",
            "error": result.get("error"),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "dataset_id": "nasa_api_apod",
        }
        return record

    return result


# ---------------------------------------------------------------------------
# Mars Weather (Insight, now historical) – kept for reference
# ---------------------------------------------------------------------------

def fetch_mars_weather(dest_file: Optional[Path] = None) -> dict:
    """
    Attempt to fetch NASA InSight Mars weather data.
    NOTE: InSight mission ended in December 2022; this endpoint may return
    empty or historical data only.
    """
    result = nasa_api_get("/insight_weather/", params={"feedtype": "json", "ver": "1.0"})

    if dest_file and result["data"]:
        dest_file = Path(dest_file)
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        with open(dest_file, "w", encoding="utf-8") as fh:
            json.dump(result["data"], fh, indent=2)
        logger.info("Saved Mars weather data to %s", dest_file)

    return result


# ---------------------------------------------------------------------------
# NASA Earthdata CMR (Common Metadata Repository) search
# ---------------------------------------------------------------------------

CMR_BASE = "https://cmr.earthdata.nasa.gov/search"


def cmr_search_granules(
    short_name: str,
    bbox: list[float],
    temporal: Optional[str] = None,
    page_size: int = 10,
) -> dict:
    """
    Search NASA Earthdata CMR for dataset granules by bounding box.

    Args:
        short_name: Dataset short name, e.g. 'SRTMGL1' or 'MOD11A2'
        bbox: [west, south, east, north] in decimal degrees
        temporal: ISO temporal range, e.g. '2020-01-01T00:00:00Z,2020-12-31T23:59:59Z'
        page_size: Max results to return

    Returns:
        CMR search response dict with hits and entries
    """
    params: dict[str, Any] = {
        "short_name": short_name,
        "bounding_box": f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}",
        "page_size": page_size,
    }
    if temporal:
        params["temporal"] = temporal

    url = f"{CMR_BASE}/granules.json"
    result = {"url": url, "short_name": short_name, "hits": 0, "entries": [], "error": None}

    session = make_session()
    try:
        resp = session.get(url, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        entries = data.get("feed", {}).get("entry", [])
        result["hits"] = data.get("feed", {}).get("opensearch:totalResults", len(entries))
        result["entries"] = entries
        logger.info("CMR search '%s': %s granules found", short_name, result["hits"])
    except Exception as exc:  # noqa: BLE001
        result["error"] = str(exc)
        logger.warning("CMR search failed for %s: %s", short_name, exc)
    finally:
        session.close()

    return result


def cmr_get_download_urls(entry: dict) -> list[str]:
    """Extract direct download URLs from a CMR granule entry."""
    urls = []
    for link in entry.get("links", []):
        rel = link.get("rel", "")
        href = link.get("href", "")
        if "data#" in rel and href.startswith("http"):
            urls.append(href)
    return urls
