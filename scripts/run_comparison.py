"""
scripts/run_comparison.py
Run the TERRANEXUS Comparison Engine for all candidate × target pairs
and write JSON results to reports/.

Usage:
    python scripts/run_comparison.py
"""
from __future__ import annotations
import sys
import time
from pathlib import Path

# --- make sure project root is on sys.path regardless of cwd ---
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.comparison.engine import ComparisonEngine
from src.comparison.exporter import export_report
from src.comparison.loader import load_earth_atacama, load_moon_south_pole, load_mars_jezero


def run_pair(candidate, target, output_dir: Path) -> Path:
    t0 = time.perf_counter()
    report = ComparisonEngine.compare(candidate, target)
    elapsed = time.perf_counter() - t0
    out_path = export_report(report, output_dir=output_dir)
    print(f"  ✓  {out_path.name}  ({elapsed:.2f}s)")
    return out_path


def print_summary(path: Path) -> None:
    import json
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)

    print(f"\n  {'─'*60}")
    print(f"  candidate   : {doc['candidate_id']}")
    target_body = doc['planetary_context']['target_body']
    target_region = doc['planetary_context']['target_region']
    print(f"  target      : {target_body} / {target_region}")
    print(f"  framework   : {doc['framework']} v{doc['engine_version']}")
    for dim, data in doc["dimensions"].items():
        n_sim = len(data["similarities"])
        n_mis = len(data["mismatches"])
        n_ev  = len(data["evidence"])
        print(f"  {dim:<26}  status={data['status']:<22}  "
              f"sim={n_sim}  mis={n_mis}  ev={n_ev}")
    print(f"  limitations : {len(doc['limitations'])} physical incompatibilities documented")
    print(f"  uncertainties: {len(doc['uncertainties'])}")


def main() -> int:
    output_dir = PROJECT_ROOT / "reports"
    output_dir.mkdir(exist_ok=True)

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║   TERRANEXUS Comparison Engine — run_comparison.py  ║")
    print("╚══════════════════════════════════════════════════════╝\n")

    print("Loading datasets …")
    earth = load_earth_atacama()
    moon  = load_moon_south_pole()
    mars  = load_mars_jezero()
    print(f"  Earth Atacama  : {earth.shape}  {earth.n_valid_elevation:,} valid px  "
          f"@ {earth.resolution_m:.0f} m/px")
    print(f"  Moon South Pole: {moon.shape}   {moon.n_valid_elevation:,} valid px  "
          f"@ {moon.resolution_m:.0f} m/px")
    print(f"  Mars Jezero    : {mars.shape}    {mars.n_valid_elevation:,} valid px  "
          f"@ {mars.resolution_m:.0f} m/px")

    print("\nRunning comparisons …")
    moon_path = run_pair(earth, moon, output_dir)
    mars_path = run_pair(earth, mars, output_dir)

    print("\nSummary:")
    print_summary(moon_path)
    print_summary(mars_path)

    print("\n✅  Done. JSON files written to:", output_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
