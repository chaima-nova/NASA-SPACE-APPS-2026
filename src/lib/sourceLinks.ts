/**
 * Where each dataset lives.
 *
 * `DataSource.url` exists in the contract, but the catalogue behind it ships the
 * field empty, so every source card rendered as dead text — and a source you
 * cannot reach is not provenance. The pages below are the `official_landing_page`
 * column of `docs/dataset_catalog.csv`, the team's own record of where each
 * dataset comes from, plus the products that exist only in the bundled
 * `config/datasets.json` fallback.
 *
 * Two deviations from the CSV, both forced:
 *  - LOLA: `imbrium.mit.edu/LOLA.html` answered 404 on 2026-11-14, so the LOLA
 *    rows point at the PDS Lunar Orbiter Laser Altimeter mission page instead.
 *  - `mars_ctx_mosaic` and `mcs_temperature` have no CSV row; they point at the
 *    products' own pages.
 *
 * Every URL here answered 200 on 2026-11-14. A dataset with no page on record is
 * left as plain text rather than linked somewhere approximate.
 */
import type { DataSource } from '../data-contracts/types';

/** Landing pages, by the dataset ids the pipeline serves and the config uses. */
const SOURCE_PAGES: Record<string, string> = {
  srtm_gl1: 'https://lpdaac.usgs.gov/products/srtmgl1v003/',
  modis_lst_terra: 'https://lpdaac.usgs.gov/products/mod11a2v061/',
  modis_lc_mcd12q1: 'https://lpdaac.usgs.gov/products/mcd12q1v061/',
  mola_meg004: 'https://pds-geosciences.wustl.edu/missions/mgs/megdr.html',
  mola_meg128: 'https://pds-geosciences.wustl.edu/missions/mgs/megdr.html',
  lola_4ppd: 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm',
  lola_64ppd: 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm',
  lola_1024ppd: 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm',
  tes_thermal_inertia: 'https://pds-geosciences.wustl.edu/missions/mgs/tes-timap.html',
  diviner_gdr_l3: 'https://pds-geosciences.wustl.edu/lro/lro-l-dlre-4-rdr-v1/lrodlr_1001/',
  nasa_api_apod: 'https://api.nasa.gov/',
  mcs_temperature:
    'https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/MARS/mcs.html',
  mars_ctx_mosaic: 'https://murray-lab.caltech.edu/CTX/',
};

/**
 * Products recognised by name rather than id.
 *
 * The served catalogue and the bundled config do not share ids for every
 * dataset, and a rename should not silently cost a card its link. The patterns
 * are product designations, specific enough not to collide.
 */
const NAME_PAGES: readonly (readonly [RegExp, string])[] = [
  [/SRTM/i, 'https://lpdaac.usgs.gov/products/srtmgl1v003/'],
  [/MOD11A2/i, 'https://lpdaac.usgs.gov/products/mod11a2v061/'],
  [/MCD12Q1/i, 'https://lpdaac.usgs.gov/products/mcd12q1v061/'],
  [/TES Thermal Inertia/i, 'https://pds-geosciences.wustl.edu/missions/mgs/tes-timap.html'],
  [/Diviner/i, 'https://pds-geosciences.wustl.edu/lro/lro-l-dlre-4-rdr-v1/lrodlr_1001/'],
  [/MOLA/i, 'https://pds-geosciences.wustl.edu/missions/mgs/megdr.html'],
  [/LOLA/i, 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm'],
  [/CTX Mosaic/i, 'https://murray-lab.caltech.edu/CTX/'],
  [/MCS|Climate Sounder/i, SOURCE_PAGES.mcs_temperature],
  [/\bAPOD\b|Astronomy Picture/i, 'https://api.nasa.gov/'],
];

/** The dataset's landing page, or null when none is on record. */
export function sourceUrl(dataset: DataSource): string | null {
  const given = dataset.url?.trim();
  if (given && /^https?:\/\//i.test(given)) return given;
  const byId = SOURCE_PAGES[dataset.id];
  if (byId) return byId;
  const byName = NAME_PAGES.find(([pattern]) => pattern.test(dataset.name));
  return byName ? byName[1] : null;
}
