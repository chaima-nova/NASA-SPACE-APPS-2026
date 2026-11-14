/**
 * Field photography for the "See Site" gallery.
 *
 * Real ground photography of each analog site, curated from Wikimedia Commons
 * (the site itself, its terrain, rocks and expedition work). Files are fetched
 * through Commons' Special:FilePath endpoint, so no local copies are shipped
 * and the licence/author stays attached to every frame.
 *
 * Photos are illustrative field references, not survey imagery; the caption
 * says so and every frame links back to its Commons file page. Captions,
 * authors and licences are read from the file metadata rather than written
 * here, so a credit that reads oddly is the uploader wording, not ours.
 */

export interface SitePhoto {
  /** Commons file name, without the "File:" prefix. */
  file: string;
  caption: string;
  credit: string;
  license: string;
}

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
    {
      file: '2007-12-31-Puerto-de-Iquique.JPG',
      caption: 'The fishing harbor of Iquique in northern Chile with the Atacama desert falling into the oce…',
      credit: 'Redfive',
      license: 'CC BY-SA 3.0',
    },
    {
      file: '56 atacama (22).jpg',
      caption: 'Puščava Atacama - vidna salinizacija - na poti proti Tihemu oceanu',
      credit: 'The original uploader was Ljuba brank at Slovenian Wikipedia .',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Aguas Verdes.jpg',
      caption: 'Aguas Verdes, route n° 5, commune de Taltal, province d\'Antofagasta, région II, Chili',
      credit: 'Bachelot Pierre J-P',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Aerial view of the Andes seen from the vicinity of Calama, Chile.png',
      caption: 'Atacama desert and the Andes on the background.',
      credit: 'Rapidavocado',
      license: 'CC BY-SA 4.0',
    },
    {
      file: 'A distant beacon (potw2233a).jpg',
      caption: 'Cerro Armazones, in Chile\'s Atacama Desert, is the site of ESO’s upcoming giant, the Extreme…',
      credit: 'ESO/ M. Zamani',
      license: 'CC BY 4.0',
    },
    {
      file: 'A winding road through the Atacama Desert (dji-20240605184841-ang).jpg',
      caption: 'This drone image from June 2024 shows ESO\'s Extremely Large Telescope ( ELT ) dome against t…',
      credit: 'ESO',
      license: 'CC BY 4.0',
    },
    {
      file: 'A winding road through the Atacama Desert (dji-20240605184824-ang).jpg',
      caption: 'This drone image from June 2024 shows the dome of ESO\'s Extremely Large Telescope ( ELT ), l…',
      credit: 'ESO',
      license: 'CC BY 4.0',
    },
    {
      file: 'A barren landscape (2017 11 17 Desert 360Pano-CC).jpg',
      caption: 'The Chilean Atacama desert is home to ESO\'s world-class observatories, including La Silla, P…',
      credit: 'P. Horálek /ESO',
      license: 'CC BY 4.0',
    },
    {
      file: 'ALMA’s dishes huddle together in the desolate landscape of Chile’s Atacama Desert (ann16035b).jpg',
      caption: 'The Large Atacama Millimeter/submillimeter Array consists of 66 dishes working together to c…',
      credit: 'A. Caproni/ESO',
      license: 'CC BY 4.0',
    },
    {
      file: 'A desert in black and white (dsc 4389-cc).jpg',
      caption: 'A somber black and white view of the Atacama.',
      credit: 'A. Coleiro/ESO',
      license: 'CC BY 4.0',
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
    {
      file: 'FMARS GeneratorShed1 2009-07-07.JPG',
      caption: 'FMARS Generator Shed, located in proximity to the Flashline Mars Arctic Research Station (FM…',
      credit: 'Jpalaia',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'FMARS TEM47‐PROTEM1 2009-07-19.jpg',
      caption: 'FMARS 2009 crew members Brian Shiro, Christy Garvin, Stacy Cusack and Kristine Ferrone deplo…',
      credit: 'Jpalaia',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'FMARS Medical Laser1 2009-07-26.jpg',
      caption: 'FMARS 2009 crew member Kristine Ferrone makes use of a Class IV High Power Laser therapy dev…',
      credit: 'Jpalaia',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'FMARS 2009 trimble.jpg',
      caption: 'FMARS commander Kramer operates the Trimble GPS',
      credit: 'Brian Shiro',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'FMARS 2009 gypsum field.jpg',
      caption: 'Finding a gypsum deposit at Gemini Hills in the Haughton Impact Crater',
      credit: 'Brian Shiro',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'FMARS 2009 gypsum heat.jpg',
      caption: 'Closeup of the powdered gypsum evolving water vapor while being heated',
      credit: 'Brian Shiro',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'FMARS 2009 gypsum water.jpg',
      caption: 'FMARS-12 Commander Kramer showing the water extracted from the gypsum sample he collected in…',
      credit: 'Brian Shiro',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'FMARS Station Construction 1 2000-07-20.jpg',
      caption: 'The first set of wall panels are erected for the Flashline Mars Arctic Research Station, on…',
      credit: 'The Mars Society',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'FMARS Station Construction 2 2000-07-21.JPG',
      caption: 'Volunteers use a scaffold to raise the wall panels for the Flashline Mars Arctic Research St…',
      credit: 'The Mars Society',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'FMARS Station Construction 3 2000-07-25.JPG',
      caption: 'The station\'s roof dome arch is formed.',
      credit: 'The Mars Society',
      license: 'CC BY-SA 3.0',
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
    {
      file: 'Death Valley floor 1.jpg',
      caption: 'View of Death Valley floor near Furnace Creek',
      credit: 'Stan Shebs',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Death Valley Ibex Hills 1.jpg',
      caption: 'Ibex Hills from Harry Wade Road, southern Death Valley , California',
      credit: 'Stan Shebs',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Death Valley from Titus Canyon 1.jpg',
      caption: 'View of Death Valley looking south from the entrance to Titus Canyon',
      credit: 'Stan Shebs',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Death Valley Ibex Dunes 1.jpg',
      caption: 'Ibex Dunes from the road to Saratoga Spring, southern Death Valley, California',
      credit: 'Stan Shebs',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Death Valley from Hells Gate (3812546782).jpg',
      caption: 'Death Valley from Hells Gate',
      credit: 'Greg Willis from Denver, CO, usa',
      license: 'CC BY-SA 2.0',
    },
    {
      file: 'Death Valley badlands - panoramio.jpg',
      caption: 'Death Valley badlands',
      credit: 'Keith Ruffles',
      license: 'CC BY 3.0',
    },
    {
      file: 'Death Valley dunes (24222942522).jpg',
      caption: 'Death Valley dunes',
      credit: 'specchio.nero',
      license: 'CC BY-SA 2.0',
    },
    {
      file: 'Death Valley (16667495872).jpg',
      caption: 'Death Valley',
      credit: 'Kunstee',
      license: 'CC BY 2.0',
    },
    {
      file: 'Death Valley Crater 2004 - panoramio.jpg',
      caption: 'Death Valley Crater 2004',
      credit: 'Annette Teng',
      license: 'CC BY 3.0',
    },
    {
      file: 'Death Valley (Unsplash Damq94mi5uk).jpg',
      caption: 'Death Valley, United States',
      credit: 'adrian aows',
      license: 'CC0',
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
    {
      file: 'Doolittle Bluff.jpg',
      caption: 'Doolittle Bluff is the ridge on the left that rises above the Suess Glacier which spills int…',
      credit: 'Jhdoolittle77',
      license: 'CC BY-SA 4.0',
    },
    {
      file: 'Asgard Range NSF photo.jpg',
      caption: 'Unspecified peak in the Asgard Range, Victoria Land, Antarctica.',
      credit: 'Tracy Szela, NSF',
      license: 'Public domain',
    },
    {
      file: 'Labyrinth, Wright Valley, McMurdo Dry Valleys, Antarctica.jpg',
      caption: 'Labyrinth, Wright Valley, McMurdo Dry Valleys, Antarctica.',
      credit: 'Dturme',
      license: 'CC BY-SA 4.0',
    },
    {
      file: 'Taylor Valley 2015 01.jpg',
      caption: 'A typical landscape in the Dry Valleys of Antarctica',
      credit: 'Jayne Belnap',
      license: 'Public domain',
    },
    {
      file: 'Taylor Valley 2008 02.jpg',
      caption: 'Canada Glacier in Taylor Valley, Antarctica',
      credit: 'David Haney, NSF',
      license: 'Public domain',
    },
    {
      file: 'Beaconhelo-HR.jpg',
      caption: 'A helicopter prepares to land at Beacon Valley in the Dry Valleys of southern Victoria Land.',
      credit: 'Josh Landis, NSF',
      license: 'Public domain',
    },
    {
      file: 'Beacon Valley field camp 2005.jpg',
      caption: 'LTER Beacon Valley field camp',
      credit: 'Josh Landis, National Science Foundation',
      license: 'Public domain',
    },
    {
      file: 'Beacon Valley.jpg',
      caption: 'Picture of Beacon Valley, in the McMurdo Dry Valleys of Antarctica.',
      credit: 'Alfonso Davila - NASA',
      license: 'Public domain',
    },
    {
      file: 'Beacon Valley 2019-02-04 01.jpg',
      caption: 'A weather monitoring station collects climate data at the far end of Beacon Valley.',
      credit: 'Mike Lucibella, NSF',
      license: 'Public domain',
    },
    {
      file: 'Beacon Valley 2019-02-04 02.jpg',
      caption: 'Earth Scientist Jennifer Lamp adjust some of the weather monitoring equipment she set up in…',
      credit: 'Mike Lucibella, NSF',
      license: 'Public domain',
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
    {
      file: 'Mauna Kea night time view.jpg',
      caption: 'View from Mauna Kea.',
      credit: 'Rustedstrings',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Big Island Summit Winter 1971 (2).jpg',
      caption: 'The Big Island Hawaii has Mauna Kea the summit is closer to the sun than any other place on…',
      credit: 'SABO123',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Cloud martini (20429426043).jpg',
      caption: '100+ megapixel view from Mauna Kea summit.',
      credit: 'mail_collector',
      license: 'CC BY 2.0',
    },
    {
      file: 'Mauna Kea And Saddle DSC 0155 (47563806692).jpg',
      caption: 'Mauna Kea And Saddle DSC_0155',
      credit: 'Bill Abbott',
      license: 'CC BY-SA 2.0',
    },
    {
      file: 'Hale Pohaku Commons (Hale-Pohaku-Matsopoulos 4-CC).jpg',
      caption: 'The commons inside of Hale Pohaku, located midway to the summit of Maunakea, Hawaiʻi.',
      credit: 'NOIRLab/NSF/AURA/T. Matsopoulos',
      license: 'CC BY 4.0',
    },
    {
      file: 'Hale Pohaku at Maunakea (Hale-Pohaku-Matsopoulos 3-CC).jpg',
      caption: 'Hale Pohaku – Hawaiian for “Stone House” — is located midway to the summit of Maunakea, Hawa…',
      credit: 'NOIRLab/NSF/AURA/T. Matsopoulos',
      license: 'CC BY 4.0',
    },
    {
      file: 'Cherry blossoms in Waimea with Mauna Kea.jpg',
      caption: 'Cherry blossoms in Waimea with Mauna Kea with snow',
      credit: 'Yoshi Canopus',
      license: 'CC BY-SA 4.0',
    },
    {
      file: 'Geminids-over-maunakea-cc December 2020.jpg',
      caption: 'A brilliant Geminid fireball over Gemini North on Maunakea on the island of Hawai‘i 13 December 2020.',
      credit: 'International Gemini Observatory/NOIRLab/NSF/AURA',
      license: 'CC BY 4.0',
    },
    {
      file: 'Fireball from Maunakea (220220-212051-CC).jpg',
      caption: 'A bright meteor known as a "fireball" can be seen in this image taken from Maunakea.',
      credit: 'NOIRLab/AURA/NSF',
      license: 'CC BY 4.0',
    },
    {
      file: 'Dubautia arborea.jpg',
      caption: 'Dubuatia arborea growing on the slopes of Mauna Kea in subalpine tropical dry forest',
      credit: 'Grigory Heaton',
      license: 'CC BY-SA 4.0',
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
    {
      file: 'Apua Point.jpg',
      caption: 'ʻĀpua Point from Hōlei Pali, Kilauea, Hawaii, United States',
      credit: 'Lisa Eidson from Greenough, MT, USA',
      license: 'CC BY 2.0',
    },
    {
      file: 'Volcano House Ad.jpg',
      caption: '"Volcano House Situated on the brink of Kilauea Crater, overlooking the molten lake of fire.',
      credit: 'The San Francisco Call, August 14, 1912',
      license: 'Public domain',
    },
    {
      file: 'Big Island Summit Winter 1971.jpg',
      caption: 'The Big Island Hawaii has Mauna Kea the summit is closer to the sun than any other place on…',
      credit: 'SABO123',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Natural history of Hawaii (Page 166) (7007386276).jpg',
      caption: 'Natural history of Hawaii (Page 166) (7007386276)',
      credit: 'Bryan, William Alanson',
      license: 'Public domain',
    },
    {
      file: 'Lava Dome (24366962292).jpg',
      caption: 'Kilauea Big Island, Hawaii',
      credit: 'incidencematrix',
      license: 'CC BY 2.0',
    },
    {
      file: 'Starr-130320-3428-Casuarina equisetifolia-habit view Mokolea Pt-Sea Cliff Kilauea-Kauai (24582360903).jpg',
      caption: 'Casuarina equisetifolia (Ironwood) Habit view Mokolea Pt at Sea Cliff Kilauea, Kauai, Hawaii.',
      credit: 'Forest and Kim Starr',
      license: 'CC BY 3.0 us',
    },
    {
      file: 'Star-Bulletin March1916.jpg',
      caption: 'Advertisement for Inter-Island Steam Navigation\'s tour package to visit the Kilauea Volcano…',
      credit: 'Unknown author Unknown author',
      license: 'Public domain',
    },
    {
      file: 'Kilauea Volcano and lava flows from fissures near Leilani Estates, Hawaii, USA (40544299770).jpg',
      caption: 'Contains modified Copernicus Sentinel data [2018], processed by &lt;a href=" https://twitter…',
      credit: 'Pierre Markuse from Hamm, Germany',
      license: 'CC BY 2.0',
    },
    {
      file: 'Kilauea episode 42.jpg',
      caption: 'Explosive fountain of episode 42',
      credit: 'Manuhiti',
      license: 'CC0',
    },
    {
      file: 'Alae lava cascade 5 august 1969.jpg',
      caption: 'Lava cascades from Mauna Ulu flowing down into Alae crater, Kilauea, Hawaii, United States',
      credit: 'Donald A. Swanson, USGS',
      license: 'Public domain',
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
    {
      file: 'Nerva 01 by-dpc.jpg',
      caption: 'Road to "Peña del Hierro" mine in Nerva .',
      credit: 'David Perez',
      license: 'CC BY 4.0',
    },
    {
      file: 'Nerva 02 malacate by-dpc.jpg',
      caption: 'Mining winch or elevator.',
      credit: 'David Perez',
      license: 'CC BY 4.0',
    },
    {
      file: 'Minas de Riotinto 11 infraestructuras mineras by-dpc.jpg',
      caption: 'Some buildings in former mines of Minas de Riotinto .',
      credit: 'David Perez',
      license: 'CC BY 4.0',
    },
    {
      file: 'Minas de Riotinto 12 infraestructuras mineras by-dpc.jpg',
      caption: 'Slag heaps in former mines of Minas de Riotinto .',
      credit: 'David Perez',
      license: 'CC BY 4.0',
    },
    {
      file: 'Minas de Riotinto 13 infraestructuras mineras by-dpc.jpg',
      caption: 'Sulfide slags in former mines of Minas de Riotinto .',
      credit: 'David Perez',
      license: 'CC BY 4.0',
    },
    {
      file: 'Minas de Riotinto 14 infraestructuras mineras by-dpc.jpg',
      caption: 'Remains of pipes and siphons in former mines of Minas de Riotinto .',
      credit: 'David Perez',
      license: 'CC BY 4.0',
    },
    {
      file: 'Minas de Riotinto 35 infraestructuras mineras by-dpc.jpg',
      caption: 'Mine in Minas de Riotinto .',
      credit: 'David Perez',
      license: 'CC BY 4.0',
    },
    {
      file: 'Minas de Riotinto 45 infraestructuras mineras by-dpc.jpg',
      caption: 'Railway building in Minas de Riotinto .',
      credit: 'David Perez',
      license: 'CC BY 4.0',
    },
    {
      file: 'Minas de Riotinto 46 minas manganeso by-dpc.jpg',
      caption: 'Manganese vein in Minas de Riotinto .',
      credit: 'David Perez',
      license: 'CC BY 4.0',
    },
    {
      file: 'Minas de Riotinto 48 mina by-dpc.jpg',
      caption: 'River Tinto in Minas de Riotinto .',
      credit: 'David Perez',
      license: 'CC BY 4.0',
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
    {
      file: 'Crater of spatter-and-scoria cone Caldera de los Cuervos on Lanzarote, June 2013 (1).jpg',
      caption: 'View from the top of cone to the crater of spatter-and scoria cone called "Caldera de los Cu…',
      credit: 'Chmee2',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Crater of spatter-and-scoria cone Caldera de los Cuervos on Lanzarote, June 2013 (3).jpg',
      caption: 'Crater of spatter-and scoria cone called "Caldera de los Cuervos" situated western from Masd…',
      credit: 'Chmee2',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Detail of spatter-and-scoria cone flanks Caldera de los Cuervos on Lanzarote, June 2013 (1).jpg',
      caption: 'Detail of spatter-and scoria cone called "Caldera de los Cuervos" flank situated western fro…',
      credit: 'Chmee2',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Detail to cinder particles forming flanks of cone Caldera de los Cuervos on Lanzarote, June 2013(1).jpg',
      caption: 'Detail of cinder particles forming part of scoria cone called "Caldera de los Cuervos" flank…',
      credit: 'Chmee2',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Detail of spatter particles forming flanks of cone Caldera de los Cuervos on Lanzarote, June 2013 (1).jpg',
      caption: 'Detail of spatter particles forming part of scoria cone called "Caldera de los Cuervos" flan…',
      credit: 'Chmee2',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Entrance into crater of spatter-and-scoria cone Caldera de los Cuervos on Lanzarote, June 2013 (1).jpg',
      caption: 'Entrance into crater of spatter-and-scoria cone called "Caldera de los Cuervos" situated wes…',
      credit: 'Chmee2',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Inner crater rim formed by spatter particles on cone Caldera de los Cuervos on Lanzarote, June 2013 (1).jpg',
      caption: 'Inner crater rim formed by spatter particles forming part of scoria cone called "Caldera de…',
      credit: 'Chmee2',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Volcán del Cuervo 01.jpg',
      caption: 'Volcán del Cuervo, Tinajo , Lanzarote , Canary Islands , Spain , view from northeast.',
      credit: 'H. Zell',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Launaea cf. arborescens-pjt.jpg',
      caption: 'Launaea cf. arborescens , Lanzarote, Canary Islands.',
      credit: 'Pjt56 --- If you use the picture outside Wikipedia I would appreciate a short e-',
      license: 'CC BY-SA 4.0',
    },
    {
      file: 'LanzarotePlant-pjt 01.jpg',
      caption: 'Unidentified plant, Lanzarote, Canary Islands',
      credit: 'Pjt56 --- If you use the picture outside Wikipedia I would appreciate a short e-',
      license: 'CC BY-SA 4.0',
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
    {
      file: 'Craters of the Moon National Monument - Idaho (14377668630).jpg',
      caption: 'Craters of the Moon National Monument - Idaho',
      credit: 'Doug Kerr from Albany, NY, United States',
      license: 'CC BY-SA 2.0',
    },
    {
      file: 'A contrast of harsh landscape - lava vs. mountain (15838211943).jpg',
      caption: 'a contrast of harsh landscape - lava vs.',
      credit: 'Craters of the Moon National Monument & Preserve',
      license: 'CC BY 2.0',
    },
    {
      file: 'Artifacts (14016297083).jpg',
      caption: 'artifacts',
      credit: 'Craters of the Moon National Monument & Preserve',
      license: 'CC BY 2.0',
    },
    {
      file: 'Craters of the Moon National Monument - 9.jpg',
      caption: 'Craters of the Moon National Monument',
      credit: 'dwhartwig',
      license: 'CC BY 2.0',
    },
    {
      file: 'Craters of the Moon National Monument - Bob Wick, BLM.jpg',
      caption: 'Craters of the Moon National Monument; by: Bob Wick, BLM',
      credit: 'BLMIdaho',
      license: 'CC BY 2.0',
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
    {
      file: 'Aiken Spring 202107-1.jpg',
      caption: 'Aiken Spring 1',
      credit: 'China News Service',
      license: 'CC BY 4.0',
    },
    {
      file: 'Aiken Spring 202107-2.jpg',
      caption: 'Aiken Spring 2',
      credit: 'China News Service',
      license: 'CC BY 4.0',
    },
    {
      file: 'Dachaidamu Lake 2018-08-01.jpg',
      caption: 'Dachaidamu Lake in Qinghai province, China on 2018-08-01',
      credit: 'Daniel Eriksson',
      license: 'CC BY 4.0',
    },
    {
      file: 'Qaidam-basin-china.jpg',
      caption: 'STS040-613-011 Qaidam Basin, China June 1991 This mostly east-looking view [ here rotated to…',
      credit: 'NASA',
      license: 'Public domain',
    },
    {
      file: 'Xiao Qaidam Lake 2022-10-13 Sentinel-2 L2A True color.jpg',
      caption: 'Xiao Qaidam Lake, China',
      credit: 'European Space Agency',
      license: 'Attribution',
    },
    {
      file: 'Keluke Lake 2021-05-13 Sentinel-2 L2A True color.jpg',
      caption: 'Keluke Lake, China',
      credit: 'European Space Agency',
      license: 'Attribution',
    },
    {
      file: 'Tuosu Lake 2022-04-08 Sentinel-2 L2A True color.jpg',
      caption: 'Tuosu Lake, China',
      credit: 'European Space Agency',
      license: 'Attribution',
    },
    {
      file: 'Altyn-Tagh Aksai Jiuquan Gansu China 甘粛省 阿克塞哈萨克族自治县 阿尔金山脉 - panoramio (3).jpg',
      caption: 'Altyn-Tagh Aksai Jiuquan Gansu China 甘粛省 阿克塞哈萨克族自治县 阿尔金山脉',
      credit: 'Hiroki Ogawa',
      license: 'CC BY 3.0',
    },
    {
      file: 'Lynk & Co 05 002.jpg',
      caption: 'Lynk & Co 05',
      credit: 'Jengtingchen',
      license: 'CC BY-SA 4.0',
    },
    {
      file: 'Lynk & Co 02 004.jpg',
      caption: 'Lynk & Co 02',
      credit: 'Jengtingchen',
      license: 'CC BY-SA 4.0',
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
    {
      file: 'California Fan Palms, St. George, Utah.jpg',
      caption: 'California Fan Palms in St.',
      credit: 'Staplegunther ( talk )David Jolley',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Amboy volcanic field - strandlines on basalt flow.JPG',
      caption: 'Amboy volcanic field - strandlines on basalt flow.',
      credit: 'Daniel Mayer (mav)',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Desert 1 2013-06-21.jpg',
      caption: 'Interstate 15 in California',
      credit: 'F ASTILY',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Burnt twilight in the Mojave desert.jpg',
      caption: 'Twilight in the Mojave desert',
      credit: 'Jessie Eastland',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Confused sky during twilight in the Mojave desert, Southern California.jpg',
      caption: 'Wall of air from westerly winds, keeps storm approaching from from the east at bay, during t…',
      credit: 'Jessie Eastland - uploaded by Pocketthis',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Big Sky Country, evening twilight in the Mojave desert.jpg',
      caption: 'Evening Twilight in the Mojave desert',
      credit: 'Jessie Eastland',
      license: 'CC BY-SA 4.0',
    },
    {
      file: '3D-clouds sweeping across the Mojave Desert.jpg',
      caption: 'Massive clouds sweeping across the Mojave Desert.',
      credit: 'Jessie Eastland',
      license: 'CC BY-SA 4.0',
    },
    {
      file: 'Burning Cross Sunset in black rain.jpg',
      caption: 'Mojave Desert storm approaches at sunset .',
      credit: 'Jessie Eastland',
      license: 'CC BY-SA 4.0',
    },
    {
      file: 'Astronomical dusk over the Mojave Desert.jpg',
      caption: 'Astronomical Dusk over the Mojave',
      credit: 'Jessie Eastland',
      license: 'CC BY-SA 4.0',
    },
    {
      file: 'Barton Flats fire day 7- 06-24-15.JPG',
      caption: 'Barton Flats California fire as viewed from the eastern w:Mojave desert on day number seven.',
      credit: 'Jessie Eastland',
      license: 'CC BY-SA 3.0',
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
    {
      file: 'Askja, Iceland (Unsplash).jpg',
      caption: 'Askja, Iceland',
      credit: 'Davide Cantelli cant89',
      license: 'CC0',
    },
    {
      file: 'Askja Herðubreið Iceland (174167471).jpeg',
      caption: 'Got lucky with exceptional weather on this heli tour of Iceland\'s highlands...',
      credit: 'Ilya Grigorik',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Аскья озеро.jpg',
      caption: 'Красота вулканической Исландии, озеро Аскья в кольдерре',
      credit: 'TatyanaVasilieva',
      license: 'CC BY-SA 4.0',
    },
    {
      file: 'Oskjuvatn (228271653).jpg',
      caption: 'The maar Víti and Öskjuvatn caldera lake in Iceland',
      credit: 'Jon Connell from Cambridge, UK',
      license: 'CC BY 2.0',
    },
    {
      file: '138 OESKJUVATN.JPG',
      caption: 'Öskjuvatn , the lake in the crater of the volcano Askja , Iceland.',
      credit: 'Slimguy',
      license: 'CC BY-SA 2.0 de',
    },
    {
      file: 'Holuhraun lava field 432 653hightlight pan crop 15 (28487348650).jpg',
      caption: 'Sentinel-2 images of volcanoes',
      credit: 'Pierre Markuse from Hamm, Germany',
      license: 'CC BY 2.0',
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
    {
      file: 'Labe devils homestead flow pano.jpg',
      caption: 'Lava Beds National Monument, California, USA, 9/22/2007',
      credit: 'jill, jellidonut... whatever from Raleigh, NC, USA',
      license: 'CC BY-SA 2.0',
    },
    {
      file: 'Lava Beds National Monument in summer 2012 (1).JPG',
      caption: 'Area of Captain Jack\'s Stronghold, Lava Beds National Monument, part of Medicine Lake Volcan…',
      credit: 'Chmee2',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Lava Beds National Monument in summer 2012 (10).JPG',
      caption: 'Lava Beds National Monument, part of Medicine Lake Volcano in Northern California, USA',
      credit: 'Chmee2',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Mt shasta from captain jacks stronghold, lava beds.JPG',
      caption: 'Mt Shasta, from Captain Jack\'s Stronghold, Lava Beds National Monument, California',
      credit: 'Mercurywoodrose',
      license: 'CC BY-SA 3.0',
    },
    {
      file: 'Mule Deer at Lava Beds Monument (5711529236).jpg',
      caption: 'Mule Deer at Lava Beds Monument',
      credit: 'Pacific Southwest Region from Sacramento, US',
      license: 'Public domain',
    },
    {
      file: 'Petroglyph Point.JPG',
      caption: 'Petroglyph Point in Lava Beds National Monument .',
      credit: 'Little Mountain 5',
      license: 'CC BY-SA 4.0',
    },
    {
      file: 'Juniper in Lava Beds.JPG',
      caption: 'A western juniper in Lava Beds National Monument .',
      credit: 'Little Mountain 5',
      license: 'CC BY-SA 4.0',
    },
    {
      file: 'Tule Lake field work scn 0025 (15223601154).jpg',
      caption: 'Petroglyphs at Petroglyph Point, Lava Beds National Monument.',
      credit: 'Curtis Abert',
      license: 'CC BY 2.0',
    },
    {
      file: 'Tule Lake field work Scan-141124-0051 (15878223895).jpg',
      caption: 'A lonely obsidian flake in the desert in Lava Beds National Monument.',
      credit: 'Curtis Abert',
      license: 'CC BY 2.0',
    },
    {
      file: 'Tule Lake field work Scan-141124-0022 (15690713048).jpg',
      caption: 'Lava Beds National Monument',
      credit: 'Curtis Abert',
      license: 'CC BY 2.0',
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
