"""
scratch/audit_deliverables.py
Automated deep audit of comparison engine deliverables .
"""
from __future__ import annotations
import json
from pathlib import Path

def audit_file(fpath: Path) -> dict:
    res = {'passed': True, 'checks': [], 'errors': []}
    if not fpath.exists():
        res['passed'] = False
        res['errors'].append(f'File {fpath} does not exist')
        return res
    
    with open(fpath, encoding='utf-8') as fh:
        doc = json.load(fh)
    
    # 1. Root Keys
    req_root = [
        'candidate_id', 'location', 'planetary_context',
        'dimensions', 'data_quality', 'uncertainties', 'limitations'
    ]
    for k in req_root:
        if k in doc:
            res['checks'].append(f'Root key present: {k}')
        else:
            res['passed'] = False
            res['errors'].append(f'Missing root key: {k}')
            
    # 2. No composite score
    forbidden = [
        'score', 'similarity_score', 'overall_score',
        'composite_score', 'match_percentage'
    ]
    for f in forbidden:
        if f in doc:
            res['passed'] = False
            res['errors'].append(f'VIOLATION: Found composite score key: {f}')
        else:
            res['checks'].append(f'Absence of forbidden score: {f}')

    # 3. Dimensions
    dims = doc.get('dimensions', {})
    for d_name in ['terrain_topography', 'surface_geology', 'temperature_thermal', 'solar_illumination']:
        if d_name not in dims:
            res['passed'] = False
            res['errors'].append(f'Missing dimension: {d_name}')
            continue
        d = dims[d_name]
        for sub in ['similarities', 'mismatches', 'evidence']:
            if sub not in d or not isinstance(d[sub], list):
                res['passed'] = False
                res['errors'].append(f'{d_name} missing list: {sub}')
            else:
                res['checks'].append(f'{d_name} has list: {sub} ({len(d[sub])} items)')

    # 4. Check percentiles ordering
    for d_name, d_val in dims.items():
        all_p = d_val.get('similarities', []) + d_val.get('mismatches', []) + d_val.get('evidence', [])
        for p_item in all_p:
            p_name = p_item.get('parameter', 'unknown')
            for s_key in ['candidate_stats', 'target_stats']:
                st = p_item.get(s_key)
                if st and isinstance(st, dict):
                    p10, p25, p50, p75, p90 = st.get('p10'), st.get('p25'), st.get('p50'), st.get('p75'), st.get('p90')
                    if all(x is not None for x in [p10, p25, p50, p75, p90]):
                        if not (p10 <= p25 <= p50 <= p75 <= p90):
                            res['passed'] = False
                            res['errors'].append(f'Percentiles disordered in {p_name} {s_key}: {p10}, {p25}, {p50}, {p75}, {p90}')
                        else:
                            res['checks'].append(f'Percentiles monotonically ordered in {p_name} {s_key}')

    # 5. Scientific Guards
    # absolute_elevation must be NOT_COMPARABLE
    tt_ev = dims.get('terrain_topography', {}).get('evidence', [])
    elev = [x for x in tt_ev if x.get('parameter') == 'absolute_elevation']
    if not elev or elev[0].get('state') != 'NOT_COMPARABLE':
        res['passed'] = False
        res['errors'].append('absolute_elevation is NOT marked as NOT_COMPARABLE in evidence')
    else:
        res['checks'].append('absolute_elevation correctly categorized as NOT_COMPARABLE')

    # Thermal scientific guard
    th_all = dims.get('temperature_thermal', {}).get('similarities', []) + \
             dims.get('temperature_thermal', {}).get('mismatches', []) + \
             dims.get('temperature_thermal', {}).get('evidence', [])
    th_params = {x.get('parameter'): x.get('state') for x in th_all}

    for tp in ['surface_temperature', 'day_night_thermal_amplitude', 'thermal_inertia']:
        if tp not in th_params:
            res['passed'] = False
            res['errors'].append(f'Thermal missing evaluated parameter: {tp}')
        else:
            res['checks'].append(f'Thermal parameter {tp} evaluated as {th_params.get(tp)}')

    if th_params.get('atmospheric_thermal_physics') != 'NOT_COMPARABLE':
        res['passed'] = False
        res['errors'].append("atmospheric_thermal_physics must be NOT_COMPARABLE")
    else:
        res['checks'].append("atmospheric_thermal_physics correctly categorized as NOT_COMPARABLE")

    t_body = doc.get('planetary_context', {}).get('target_body', '').lower()
    if t_body == 'mars':
        if th_params.get('thermal_inertia') != 'SIMILAR':
            res['passed'] = False
            res['errors'].append(f"Mars thermal_inertia must be SIMILAR (got {th_params.get('thermal_inertia')})")
        else:
            res['checks'].append("Mars thermal_inertia correctly categorized as SIMILAR")
    elif t_body == 'moon':
        if th_params.get('thermal_inertia') != 'DIFFERENT':
            res['passed'] = False
            res['errors'].append(f"Moon thermal_inertia must be DIFFERENT (got {th_params.get('thermal_inertia')})")
        else:
            res['checks'].append("Moon thermal_inertia correctly categorized as DIFFERENT")

    # Geology scientific guard
    geo_all = dims.get('surface_geology', {}).get('similarities', []) + \
              dims.get('surface_geology', {}).get('mismatches', []) + \
              dims.get('surface_geology', {}).get('evidence', [])
    geo_params = {x.get('parameter'): x.get('state') for x in geo_all}
    if geo_params.get('surface_material_rock_abundance') != 'SIMILAR':
        res['passed'] = False
        res['errors'].append("surface_material_rock_abundance must be SIMILAR")
    else:
        res['checks'].append("surface_material_rock_abundance correctly categorized as SIMILAR")

    # Illumination scientific guard
    illum = dims.get('solar_illumination', {})
    t_body = doc.get('planetary_context', {}).get('target_body', '').lower()
    if t_body == 'moon':
        if illum.get('status') != 'DIFFERENT':
            res['passed'] = False
            res['errors'].append(f"Moon solar_illumination status must be DIFFERENT (got {illum.get('status')})")
        else:
            res['checks'].append("Moon solar_illumination correctly categorized as DIFFERENT")
    elif t_body == 'mars':
        if illum.get('status') != 'SIMILAR':
            res['passed'] = False
            res['errors'].append(f"Mars solar_illumination status must be SIMILAR (got {illum.get('status')})")
        else:
            res['checks'].append("Mars solar_illumination correctly categorized as SIMILAR")

    # Limitations
    lims = doc.get('limitations', [])
    if len(lims) < 4:
        res['passed'] = False
        res['errors'].append(f'Expected >= 4 limitations, got {len(lims)}')
    else:
        for l in lims:
            for lk in ['factor', 'earth', 'target', 'impact']:
                if lk not in l:
                    res['passed'] = False
                    res['errors'].append(f'Limitation missing key: {lk}')
        res['checks'].append(f'Physical limitations verified: {len(lims)} factors documented')

    # Data Quality
    dq = doc.get('data_quality', {})
    for k in ['candidate_resolution_m', 'target_resolution_m', 'candidate_valid_pct', 'target_valid_pct', 'common_baseline_applied']:
        if k not in dq:
            res['passed'] = False
            res['errors'].append(f'Missing data_quality key: {k}')
        else:
            res['checks'].append(f'data_quality key present: {k}')

    return res

if __name__ == '__main__':
    root = Path(__file__).resolve().parent.parent
    files = {
        'Moon Canonical Deliverable': root / 'reports' / 'comparison_results_earth_atacama_s24w069_vs_moon.json',
        'Mars Canonical Deliverable': root / 'reports' / 'comparison_results_earth_atacama_s24w069_vs_mars.json',
        'Moon Alias Deliverable': root / 'reports' / 'comparison_results_atacama_vs_moon.json',
        'Mars Alias Deliverable': root / 'reports' / 'comparison_results_atacama_vs_mars.json',
    }
    
    total_checks = 0
    total_errors = 0
    for name, fpath in files.items():
        print(f"\n==================== Auditing: {name} ====================")
        res = audit_file(fpath)
        print(f"Status: {'PASSED' if res['passed'] else 'FAILED'}")
        print(f"Total Checks: {len(res['checks'])}")
        print(f"Total Errors: {len(res['errors'])}")
        total_checks += len(res['checks'])
        total_errors += len(res['errors'])
        if res['errors']:
            print("Errors:")
            for e in res['errors']:
                print(f"  ❌ {e}")
        else:
            print(f"Sample Passing Checks:")
            for c in res['checks'][:8]:
                print(f"  ✓ {c}")
            print(f"  ... and {len(res['checks']) - 8} more checks.")

    print(f"\n========================================================")
    print(f"OVERALL AUDIT: {'100% RELIABLE' if total_errors == 0 else 'ISSUES FOUND'}")
    print(f"Verified {total_checks} assertions across all deliverables.")
