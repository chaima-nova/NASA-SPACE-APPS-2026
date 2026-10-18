/**
 * Field photography for the "See Site" gallery.
 *
 * Real ground photography of each analog site, curated from Wikimedia Commons
 * (the site itself, its terrain, rocks and expedition work). Files are fetched
 * through Commons' Special:FilePath endpoint, so no local copies are shipped
 * and the licence/author stays attached to every frame.
 *
 * Photos are illustrative field references, not survey imagery; the caption
 * says so and every frame links back to its Commons file page.
 */

export interface SitePhoto {
  /** Commons file name, without the "File:" prefix. */
  file: string;
  caption: string;
  credit: string;
  license: string;
}

/** Keyed by the prediction's stable point id. */
const PHOTOS: Record<string, SitePhoto[]> = {
  'site-000': [
    {
      file: 'Miscanti Lagoon near San Pedro de Atacama Chile Luca Galuzzi 2006.jpg',
      caption: 'Laguna Miscanti, high altiplano south of San Pedro de Atacama',
      credit: 'Luca Galuzzi',
      license: 'CC BY-SA 2.5',
    },
    {
      file: 'Catedrales de Tara, Chile, 2016-02-07, DD 62.JPG',
      caption: 'Tara salt cathedral — yardangs cut into the altiplano',
      credit: 'Diego Delso',
      license: 'CC BY-SA 4.0',
    },
    {
      file: 'Paisaje cerca de Calama, Chile, 2016-02-01, DD 83.JPG',
      caption: 'Badlands and gravel plains near Calama',
      credit: 'Diego Delso',
      license: 'CC BY-SA 4.0',
    },
  ],
  'site-001': [
    {
      file: 'Rovers Red and Black at Houghton Crater Devon Island Canada.jpg',
      caption: 'Clifford and K10 rovers during the Haughton Mars Project field season',
      credit: 'NASA',
      license: 'Public domain',
    },
    {
      file: 'Flying over Devon Island (2665527817).jpg',
      caption: 'Devon Island from the air — polar desert and impact terrain',
      credit: 'Haughton Mars Project',
      license: 'Public domain',
    },
    {
      file: 'Shocked gneiss (Eocene, 39 Ma; Haughton Impact Structure, Devon Island, northern Canada) 1 (16841437026).jpg',
      caption: 'Shocked gneiss from the Haughton impact structure',
      credit: 'James St. John',
      license: 'CC BY 2.0',
    },
  ],
  'site-002': [
    {
      file: 'Death Valley view from Zabriskie Point with people 2013.jpg',
      caption: 'Badlands below Zabriskie Point',
      credit: 'Tuxyso',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Death Valley Mesquite Flats Sand Dunes 2013.jpg',
      caption: 'Mesquite Flat sand dunes',
      credit: 'Tuxyso',
      license: 'CC BY-SA 3.0',
    },
    {
      file: "Devil's Golf Course in Death Valley NP.jpg",
      caption: 'Devil\u2019s Golf Course salt pan',
      credit: 'Brocken Inaglory',
      license: 'CC BY-SA 3.0',
    },
  ],
  'site-003': [
    {
      file: 'Gargoyle Ridge in the McMurdo Dry Valleys in Antarctica (30877661786).jpg',
      caption: 'Gargoyle Ridge, McMurdo Dry Valleys',
      credit: 'U.S. Department of State',
      license: 'Public domain',
    },
    {
      file: 'A Glacier Flows Through a Section of the McMurdo Dry Valleys in Antarctica (30913580055).jpg',
      caption: 'Glacier flowing into a dry valley',
      credit: 'U.S. Department of State',
      license: 'Public domain',
    },
    {
      file: 'Taylor Valley of the McMurdo Dry Valleys.jpg',
      caption: 'Taylor Valley floor',
      credit: 'owamux',
      license: 'CC BY 2.0',
    },
  ],
  'site-004': [
    {
      file: 'Mauna Kea Summit (503918) (21872432126).jpg',
      caption: 'Summit ridge above the trade-wind inversion',
      credit: 'Robert Linsdell',
      license: 'CC BY 2.0',
    },
    {
      file: 'Mauna Kea Eastern Telescopes.jpg',
      caption: 'Observatories on the summit — an operational high-altitude analog',
      credit: 'Generic1139',
      license: 'CC BY 4.0',
    },
    {
      file: 'Mauna Kea Summit Trail, Mauna Kea (503901) (21770618626).jpg',
      caption: 'Summit trail across cinder and lava',
      credit: 'Robert Linsdell',
      license: 'CC BY 2.0',
    },
  ],
  'site-005': [
    {
      file: 'P\u0101hoehoe lava meets Pacific.jpg',
      caption: 'P\u0101hoehoe lava entering the Pacific',
      credit: 'Brocken Inaglory',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Lava fountain dome 2.jpg',
      caption: 'Lava fountain, K\u012blauea',
      credit: 'J.B. Judd / USGS',
      license: 'Public domain',
    },
    {
      file: 'Glowing Lava at Kilauea Vulcano2.jpg',
      caption: 'Glowing lava crust at K\u012blauea',
      credit: 'Christoph Str\u00e4ssler',
      license: 'CC BY-SA 2.0',
    },
  ],
  'site-006': [
    {
      file: 'R\u00edo Tinto, cauce 13.jpg',
      caption: 'Red mineral load in the R\u00edo Tinto channel',
      credit: 'LBM1948',
      license: 'CC BY-SA 4.0',
    },
    {
      file: 'R\u00eda del R\u00edo Tinto. Huelva.jpg',
      caption: 'Tidal reach of the R\u00edo Tinto at Huelva',
      credit: 'Jose Luis Filpo Cabana',
      license: 'CC BY 3.0',
    },
    {
      file: 'Paisaje del r\u00edo Tinto, Huelva.jpg',
      caption: 'Mining country along the R\u00edo Tinto',
      credit: 'Alberto S\u00e1nchez',
      license: 'CC BY-SA 2.0',
    },
  ],
  'site-007': [
    {
      file: 'Timanfaya - Lanzarote 02.jpg',
      caption: 'Timanfaya volcanic field, Lanzarote',
      credit: 'H. Zell',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Timanfaya - Lanzarote 08.jpg',
      caption: 'Lapilli and ash slopes in Timanfaya',
      credit: 'H. Zell',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Timanfaya - Lanzarote 16.jpg',
      caption: 'Crater rim and lava field',
      credit: 'H. Zell',
      license: 'CC BY-SA 3.0',
    },
  ],
  'site-008': [
    {
      file: 'Craters of the Moon National Monument - Idaho (14560963531).jpg',
      caption: 'Basalt lava field, Craters of the Moon',
      credit: 'Doug Kerr',
      license: 'CC BY-SA 2.0',
    },
    {
      file: 'Craters of the Moon 01.jpg',
      caption: 'Cinder and spatter terrain',
      credit: 'AndrewKPepper',
      license: 'CC BY-SA 4.0',
    },
    {
      file: 'Craters of the Moon 04.jpg',
      caption: 'Lava slabs and sagebrush',
      credit: 'AndrewKPepper',
      license: 'CC BY-SA 4.0',
    },
  ],
  'site-009': [
    {
      file: "China's Qaidam Basin Landscape Similar to Mars.jpg",
      caption: 'Qaidam Basin terrain compared with Mars by USGS',
      credit: 'David Rubin / USGS',
      license: 'Public domain',
    },
    {
      file: '\u67f4\u8fbe\u6728\u76c6\u5730 chaidamu basin - panoramio.jpg',
      caption: 'Playing field of the Qaidam Basin',
      credit: '\u767d\u4e91\u60a0\u60a0',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Sanhu.jpg',
      caption: 'Sanhu salt flats seen from orbit',
      credit: 'ESA',
      license: 'CC BY-SA 3.0 IGO',
    },
  ],
  'site-010': [
    {
      file: 'Amboy (California, USA) -- 2012 -- 4.jpg',
      caption: 'Mojave Desert near Amboy, California',
      credit: 'Dietmar Rabich',
      license: 'CC BY-SA 4.0',
    },
    {
      file: 'Jonas Deichmann in Mojave desert.jpg',
      caption: 'Field crossing of the Mojave',
      credit: 'DrUtrecht',
      license: 'CC0',
    },
    {
      file: 'Yucca Trees, Mojave Desert, Calif. (NBY 7712).jpg',
      caption: 'Yucca and creosote on the desert floor (archival)',
      credit: 'Unknown photographer',
      license: 'Public domain',
    },
  ],
  'site-011': [
    {
      file: 'Island Askja.jpg',
      caption: '\u00d6skjuvatn caldera, Askja',
      credit: 'Wolfgangbeyer',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Viti Crater Askja Iceland UL1.jpg',
      caption: 'V\u00edti explosion crater',
      credit: 'Ulrich Latzenhofer',
      license: 'CC BY-SA 2.0',
    },
    {
      file: 'Viti (Askja).jpg',
      caption: 'V\u00edti crater rim and geothermal water',
      credit: 'Areuland',
      license: 'CC BY 4.0',
    },
  ],
  'site-012': [
    {
      file: 'Lava Beds Cave collapse trench.jpg',
      caption: 'Lava-tube collapse trench (NPS)',
      credit: 'U.S. National Park Service',
      license: 'Public domain',
    },
    {
      file: 'A114, Lava Beds National Monument, California, USA, Golden Dome Lava Tube Cave, 2004.jpg',
      caption: 'Golden Dome lava tube',
      credit: 'Brian W. Schaller',
      license: 'Free Art License',
    },
    {
      file: 'Lava Beds National Monument with Mt Shasta (15121699451).jpg',
      caption: 'Lava Beds terrain with Mount Shasta behind',
      credit: 'zoxcleb',
      license: 'CC BY-SA 2.0',
    },
  ],
};

/** Commons' stable redirect for a file, with a server-side resize. */
export function photoUrl(photo: SitePhoto, width = 1400): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(photo.file)}?width=${width}`;
}

/** Human-readable Commons page for attribution and further reading. */
export function photoPageUrl(photo: SitePhoto): string {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(photo.file)}`;
}

/** Photos for a prediction; empty when the backend adds a site we have no art for. */
export function photosFor(prediction: { pointId?: string }): SitePhoto[] {
  return (prediction.pointId && PHOTOS[prediction.pointId]) || [];
}
