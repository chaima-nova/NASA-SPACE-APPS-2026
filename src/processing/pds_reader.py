"""
src/processing/pds_reader.py
Read PDS3 binary raster files (IMG + LBL) into numpy arrays.

Supports MOLA MEGaDR and LOLA GDR products.
Both are plain binary rasters described by a PDS3 label (.LBL).

Key PDS3 label fields we parse:
  LINES, LINE_SAMPLES, SAMPLE_TYPE, SAMPLE_BITS, SCALING_FACTOR, OFFSET
"""
from __future__ import annotations

import logging
import re
import struct
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# PDS3 label parser (minimal – reads what we need)
# ---------------------------------------------------------------------------

def parse_pds3_label(lbl_path: Path) -> dict:
    """
    Parse key PDS3 label keywords into a flat dict.
    Values are returned as strings; callers cast as needed.
    """
    label: dict = {}
    try:
        with open(lbl_path, "r", encoding="latin-1", errors="replace") as fh:
            for line in fh:
                line = line.strip()
                if "=" in line:
                    key, _, value = line.partition("=")
                    key = key.strip()
                    # Remove trailing inline comments
                    if "/*" in value:
                        value = value.partition("/*")[0]
                    value = value.strip().strip('"').strip("'")
                    # Strip bracketed unit tags like <DEGREE> or <deg>
                    if "<" in value:
                        val_num = value.partition("<")[0].strip()
                        if val_num:
                            value = val_num
                    label[key] = value
                if line == "END":
                    break
    except OSError as exc:
        logger.error("Cannot read PDS3 label %s: %s", lbl_path, exc)
    return label


def _to_float(val: object, default: float = 0.0) -> float:
    """Safely cast label value to float, ignoring units like <deg>."""
    if val is None:
        return default
    s = str(val).partition("<")[0].partition("/*")[0].strip().strip('"').strip("'")
    try:
        return float(s)
    except (ValueError, TypeError):
        m = re.search(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", s)
        return float(m.group(0)) if m else default



# ---------------------------------------------------------------------------
# IMG binary reader
# ---------------------------------------------------------------------------

def read_pds3_img(img_path: Path, lbl_path: Optional[Path] = None) -> dict:
    """
    Read a PDS3 IMG binary raster into a numpy array.

    Args:
        img_path: Path to .IMG binary file
        lbl_path: Path to .LBL label file (defaults to same stem as img_path)

    Returns:
        dict with keys:
          data       : numpy array (float32), no-data converted to NaN
          nrows      : int
          ncols      : int
          scale      : float  (SCALING_FACTOR from label)
          offset     : float  (OFFSET from label)
          nodata_raw : original no-data integer value
          label      : raw label dict
          error      : None or error string
    """
    result = {
        "data": None,
        "nrows": 0,
        "ncols": 0,
        "scale": 1.0,
        "offset": 0.0,
        "nodata_raw": None,
        "label": {},
        "error": None,
    }

    img_path = Path(img_path)
    if lbl_path is None:
        lbl_path = img_path.with_suffix(".LBL")
        if not lbl_path.exists():
            lbl_path = img_path.with_suffix(".lbl")

    if not img_path.exists():
        result["error"] = f"IMG file not found: {img_path}"
        return result

    # ── Parse label ────────────────────────────────────────────────────────
    label = {}
    if lbl_path and lbl_path.exists():
        label = parse_pds3_label(lbl_path)
        result["label"] = label
    else:
        logger.warning("No PDS3 label found for %s – using defaults", img_path.name)

    try:
        nrows = int(label.get("LINES", label.get("LINE", 0)))
        ncols = int(label.get("LINE_SAMPLES", label.get("SAMPLE", 0)))
        sample_bits = int(label.get("SAMPLE_BITS", 16))
        sample_type_raw = label.get("SAMPLE_TYPE", "LSB_INTEGER").upper()
        scale = float(label.get("SCALING_FACTOR", 1.0))
        offset = float(label.get("OFFSET", 0.0))
    except (ValueError, TypeError) as exc:
        result["error"] = f"Label parsing error: {exc}"
        return result

    if nrows == 0 or ncols == 0:
        result["error"] = "Could not determine image dimensions from label"
        return result

    # ── Determine numpy dtype ──────────────────────────────────────────────
    #  MOLA MEGaDR: MSB_INTEGER (big-endian signed 16-bit)
    #  LOLA LDEM:   LSB_INTEGER (little-endian signed 16-bit)
    if sample_bits == 16:
        if "MSB" in sample_type_raw:
            dtype = np.dtype(">i2")  # big-endian int16
        else:
            dtype = np.dtype("<i2")  # little-endian int16
        nodata_raw = -32768
    elif sample_bits == 32:
        dtype = np.dtype("<f4")  # float32 (LOLA 1024ppd)
        nodata_raw = -32768
    else:
        result["error"] = f"Unsupported SAMPLE_BITS: {sample_bits}"
        return result

    result["nrows"] = nrows
    result["ncols"] = ncols
    result["scale"] = scale
    result["offset"] = offset
    result["img_west"] = _to_float(label.get("WESTERNMOST_LONGITUDE"), 0.0)
    result["img_east"] = _to_float(label.get("EASTERNMOST_LONGITUDE"), 360.0)
    result["img_north"] = _to_float(label.get("MAXIMUM_LATITUDE"), 90.0)
    result["img_south"] = _to_float(label.get("MINIMUM_LATITUDE"), -90.0)


    # ── Read binary ────────────────────────────────────────────────────────
    try:
        raw = np.fromfile(img_path, dtype=dtype)
        expected = nrows * ncols
        if raw.size < expected:
            logger.warning(
                "File shorter than expected: got %d elements, expected %d",
                raw.size,
                expected,
            )
            # Pad with nodata
            raw = np.concatenate([raw, np.full(expected - raw.size, nodata_raw, dtype=dtype)])
        raw = raw[:expected].reshape(nrows, ncols)
    except Exception as exc:  # noqa: BLE001
        result["error"] = f"Binary read error: {exc}"
        return result

    # ── Apply scale/offset and mask nodata ────────────────────────────────
    # Scientific note:
    # In LOLA labels (e.g. LDEM_4.LBL), OFFSET=1737400. is the reference radius.
    # The label explicitly documents:
    #   HEIGHT = (DN * SCALING_FACTOR)
    #   PLANETARY_RADIUS = (DN * SCALING_FACTOR) + OFFSET
    # Surface elevation relative to the lunar sphere is HEIGHT (without + OFFSET).
    arr = raw.astype(np.float32)
    mask = arr == nodata_raw

    if offset >= 100_000.0:
        # Offset represents reference sphere radius (e.g. Moon 1737.4 km)
        elevation = arr * scale
        result["radius_offset_m"] = offset
    else:
        elevation = arr * scale + offset

    elevation[mask] = np.nan
    result["data"] = elevation
    logger.info(
        "Read %s: shape=%s, elevation range=[%.1f, %.1f] m",
        img_path.name,
        elevation.shape,
        float(np.nanmin(elevation)),
        float(np.nanmax(elevation)),
    )
    return result


# ---------------------------------------------------------------------------
# SRTM / NASADEM .HGT binary reader
# ---------------------------------------------------------------------------

def read_hgt_file(hgt_path: Path) -> dict:
    """
    Read an SRTM or NASADEM .HGT binary raster into a numpy array.

    HGT files are raw 16-bit signed big-endian integers (>i2), unprojected WGS84.
    - SRTM GL1 (1 arcsecond): 3601 x 3601 pixels (~25.9 MB)
    - SRTM GL3 (3 arcseconds): 1201 x 1201 pixels (~2.88 MB)
    No-data value is -32768.

    Tile coordinates are inferred from the filename (e.g. 'S24W069.hgt' -> south=-24, west=-69).
    """
    hgt_path = Path(hgt_path)
    result = {
        "data": None,
        "nrows": 0,
        "ncols": 0,
        "west": 0.0,
        "south": 0.0,
        "east": 0.0,
        "north": 0.0,
        "resolution_deg": 1.0 / 3600.0,
        "nodata_raw": -32768,
        "error": None,
    }

    if not hgt_path.exists():
        result["error"] = f"HGT file not found: {hgt_path}"
        return result

    size = hgt_path.stat().st_size
    if size == 25_934_402:
        nrows = ncols = 3601
        res = 1.0 / 3600.0
    elif size == 2_884_802:
        nrows = ncols = 1201
        res = 3.0 / 3600.0
    else:
        # Generic square 16-bit
        n = int(np.sqrt(size / 2))
        if n * n * 2 == size:
            nrows = ncols = n
            res = 1.0 / (n - 1)
        else:
            result["error"] = f"Unrecognized HGT file size: {size} bytes"
            return result

    # Infer bounding box from filename like S24W069.hgt
    stem = hgt_path.stem.upper()
    m = re.match(r"^([NS])(\d{2})([EW])(\d{3})$", stem)
    if m:
        lat_sign = -1.0 if m.group(1) == "S" else 1.0
        lon_sign = -1.0 if m.group(3) == "W" else 1.0
        lat_base = float(m.group(2)) * lat_sign
        lon_base = float(m.group(4)) * lon_sign
        result["south"] = lat_base
        result["north"] = lat_base + 1.0
        result["west"] = lon_base
        result["east"] = lon_base + 1.0

    result["nrows"] = nrows
    result["ncols"] = ncols
    result["resolution_deg"] = res

    try:
        raw = np.fromfile(hgt_path, dtype=np.dtype(">i2")).reshape((nrows, ncols))
        arr = raw.astype(np.float32)
        arr[raw == -32768] = np.nan
        result["data"] = arr
        logger.info(
            "Read HGT %s: %dx%d, elevation range=[%.1f, %.1f] m",
            hgt_path.name,
            ncols,
            nrows,
            float(np.nanmin(arr)),
            float(np.nanmax(arr)),
        )
    except Exception as exc:  # noqa: BLE001
        result["error"] = f"Error reading HGT: {exc}"

    return result



# ---------------------------------------------------------------------------
# GeoTIFF writer (requires rasterio)
# ---------------------------------------------------------------------------

def img_to_geotiff(
    img_path: Path,
    lbl_path: Optional[Path] = None,
    out_path: Optional[Path] = None,
    planet: str = "earth",
    west: float = -180.0,
    south: float = -90.0,
    east: float = 180.0,
    north: float = 90.0,
) -> dict:
    """
    Convert a PDS3 IMG raster to GeoTIFF.

    CRS is set based on planet:
      earth → EPSG:4326
      mars  → equirectangular with Mars IAU 2015 semi-major axis
      moon  → equirectangular with Moon IAU 2015 radius

    Returns dict with out_path, shape, crs, error.
    """
    result = {"out_path": None, "shape": None, "crs": None, "error": None}

    try:
        import rasterio
        from rasterio.crs import CRS
        from rasterio.transform import from_bounds
    except ImportError:
        result["error"] = "rasterio not installed. Run: pip install rasterio"
        return result

    read = read_pds3_img(img_path, lbl_path)
    if read["error"]:
        result["error"] = read["error"]
        return result

    arr = read["data"]
    nrows, ncols = arr.shape

    if out_path is None:
        out_path = img_path.with_suffix(".tif")
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # ── CRS selection ──────────────────────────────────────────────────────
    if planet.lower() == "earth":
        crs = CRS.from_epsg(4326)
    elif planet.lower() == "mars":
        # Mars areocentric spherical equirectangular (IAU 2000 Mars sphere)
        # Note: 3376.2 km polar radius applies only to polar stereographic projection
        crs = CRS.from_proj4(
            "+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 "
            "+x_0=0 +y_0=0 +a=3396190 +b=3396190 +units=m +no_defs"
        )
    elif planet.lower() == "moon":
        # Moon selenocentric equirectangular (IAU 2015)
        crs = CRS.from_proj4(
            "+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 "
            "+x_0=0 +y_0=0 +a=1737400 +b=1737400 +units=m +no_defs"
        )
    else:
        result["error"] = f"Unknown planet: {planet}"
        return result

    transform = from_bounds(west, south, east, north, ncols, nrows)

    try:
        with rasterio.open(
            out_path,
            "w",
            driver="GTiff",
            height=nrows,
            width=ncols,
            count=1,
            dtype=rasterio.float32,
            crs=crs,
            transform=transform,
            nodata=np.nan,
            compress="lzw",
        ) as dst:
            dst.write(arr, 1)
            dst.update_tags(
                source=str(img_path),
                planet=planet,
                scale=str(read["scale"]),
                offset=str(read["offset"]),
            )

        result["out_path"] = str(out_path)
        result["shape"] = arr.shape
        result["crs"] = str(crs)
        logger.info("Wrote GeoTIFF: %s (%dx%d)", out_path.name, ncols, nrows)
    except Exception as exc:  # noqa: BLE001
        result["error"] = str(exc)

    return result


# ---------------------------------------------------------------------------
# TES Thermal Inertia Binary Reader (Putzig et al. 2005)
# ---------------------------------------------------------------------------

def read_tes_thermal_inertia(
    bin_path: Path,
    mask_path: Optional[Path] = None,
    header_bytes: int = 7200,
    rows: int = 3600,
    cols: int = 7200,
) -> dict:
    """
    Read Putzig et al. (2005) MGS TES Thermal Inertia binary (e.g. nmap2003.bin).

    The file was written on a Sun workstation (big-endian 16-bit integer)
    with a 7200-byte ASCII header. Shape is 3600 rows x 7200 cols (20 ppd, ~3 km/pix).
    Units: J m^-2 K^-1 s^-1/2 (tiu).

    If mask_path is provided, real TES measurements are retained where mask == 1,
    while interpolated/unmeasured cells (mask == 0) are converted to NaN.

    Returns dict with keys:
      data: 2D float32 numpy array with thermal inertia in SI units (NaN for unmeasured)
      raw_data: 2D int16 numpy array
      mask: 2D uint8 numpy array (or None)
      shape: (rows, cols)
      resolution_deg: 0.05
      units: 'J m^-2 K^-1 s^-1/2'
      error: None or str
    """
    result = {
        "data": None,
        "raw_data": None,
        "mask": None,
        "shape": (rows, cols),
        "resolution_deg": 180.0 / rows,
        "units": "J m^-2 K^-1 s^-1/2",
        "header": None,
        "error": None,
    }

    bin_path = Path(bin_path)
    if not bin_path.exists():
        result["error"] = f"TES binary file not found: {bin_path}"
        return result

    try:
        with open(bin_path, "rb") as fh:
            header_raw = fh.read(header_bytes)
            result["header"] = header_raw.decode("ascii", errors="replace").strip()
            # Read remainder as big-endian int16
            raw_bytes = fh.read()
            expected_bytes = rows * cols * 2
            if len(raw_bytes) < expected_bytes:
                result["error"] = (
                    f"TES binary truncated: got {len(raw_bytes)} bytes, expected {expected_bytes}"
                )
                return result

            # Parse Sun big-endian 16-bit integers
            arr = np.frombuffer(raw_bytes[:expected_bytes], dtype=">i2").reshape((rows, cols))
            result["raw_data"] = arr

            # Convert to float32
            data_ti = arr.astype(np.float32)

            # Apply interpolation mask if available
            if mask_path and Path(mask_path).exists():
                with open(mask_path, "rb") as mfh:
                    # Mask can be raw bytes or have a header
                    m_bytes = mfh.read()
                    if len(m_bytes) >= rows * cols:
                        mask_arr = np.frombuffer(m_bytes[-rows * cols:], dtype=np.uint8).reshape((rows, cols))
                        result["mask"] = mask_arr
                        # 1 = real TES observation, 0 = interpolated or unmeasured
                        data_ti[mask_arr == 0] = np.nan
                    else:
                        logger.warning("Mask file size smaller than expected grid: %d bytes", len(m_bytes))
            else:
                # Standard nodata for unmasked: values <= 0 or flag values
                data_ti[data_ti <= 0] = np.nan

            result["data"] = data_ti
            logger.info("Successfully read TES thermal inertia: shape=%s, valid=%d", (rows, cols), np.count_nonzero(~np.isnan(data_ti)))
    except Exception as exc:  # noqa: BLE001
        result["error"] = str(exc)

    return result
