import { engineComparisons, measuredTerrain } from '../../services/pipeline';

/**
 * What an analogue site could be used for.
 *
 * Finding an analogue is only half the challenge: a site is worth publishing
 * because somebody could go and test something there. These five lines of
 * investigation — terrain and mobility, geology and materials, environmental
 * processes, resources and the subsurface, human and robotic preparation — turn
 * each candidate into questions a field campaign could answer, and name the
 * measurement each one needs.
 *
 * Every number, verdict and dataset count below is read from the pipeline at
 * build time: the measured terrain statistics in `data/samples/*_stats.json` and
 * the engine's comparison reports in `reports/*.json`. Nothing here is a result.
 * These are prompts, deliberately paired with the evidence that makes them
 * answerable and the gap that makes them worth doing.
 */

const sampleOf = (planet: 'earth' | 'mars' | 'moon') =>
  measuredTerrain.find((sample) => sample.planet === planet);

const earth = sampleOf('earth');
const mars = sampleOf('mars');

/** How the engine words each status, lowercased so it reads inside a sentence. */
const STATUS_WORDS: Record<string, string> = {
  DIFFERENT: 'different',
  SIMILAR: 'similar',
  QUALITATIVE_MATCH: 'a qualitative match',
  INSUFFICIENT_EVIDENCE: 'insufficient evidence',
  NOT_COMPARABLE: 'not comparable',
};

/** One dimension's verdict on one target, as a word rather than an enum. */
function statusWord(target: 'mars' | 'moon', dimensionId: string): string {
  const dimension = engineComparisons
    .find((comparison) => comparison.target === target)
    ?.dimensions.find((entry) => entry.id === dimensionId);
  if (!dimension) return 'no recorded verdict';
  return STATUS_WORDS[dimension.status] ?? dimension.status.toLowerCase();
}

/**
 * The same dimension across both targets: "insufficient evidence on both
 * targets" when the reports agree, the two verdicts named separately when they
 * do not. Read from the reports, so a re-run of the engine changes the sentence.
 */
function verdictPair(dimensionId: string): string {
  const marsWord = statusWord('mars', dimensionId);
  const moonWord = statusWord('moon', dimensionId);
  return marsWord === moonWord
    ? `${marsWord} on both targets`
    : `${marsWord} on Mars and ${moonWord} on the Moon`;
}

/** The target grid resolution, as the report measured it. */
function targetResolution(target: 'mars' | 'moon'): string {
  const comparison = engineComparisons.find((entry) => entry.target === target);
  return comparison
    ? `${comparison.targetResolutionM.toLocaleString('en-US')} m/px`
    : 'a grid the reports do not carry';
}

/** Resolution of the Earth candidate, shared by both comparisons. */
const candidateResolution = engineComparisons[0]
  ? `${engineComparisons[0].candidateResolutionM} m/px`
  : 'the candidate grid';

/**
 * The measured baselines, each formatted once. Real statistics from SRTM and
 * MOLA, quoted so a reader can see how thin the evidence is next to the
 * confidence a single score invites.
 */
const atacama = earth
  ? `${earth.slopeMeanDeg.toFixed(2)}° mean slope, ${earth.slopeMaxDeg.toFixed(
      2,
    )}° steepest cell and ${earth.roughnessMeanM.toFixed(1)} m TRI roughness, at ${candidateResolution}`
  : 'slope and roughness the pipeline has not published for this site';

const jezero = mars
  ? `${mars.slopeMeanDeg.toFixed(2)}° mean slope and ${mars.roughnessMeanM.toFixed(
      1,
    )} m TRI roughness at ${targetResolution('mars')}`
  : 'slope and roughness the pipeline has not published for Jezero';

/** Every dimension check the reports still call INSUFFICIENT_EVIDENCE. */
const thin = engineComparisons
  .flatMap((comparison) => comparison.dimensions)
  .filter((dimension) => dimension.status === 'INSUFFICIENT_EVIDENCE');
const thinLabels = [...new Set(thin.map((dimension) => dimension.label.toLowerCase()))];
const dimensionTotal = engineComparisons.reduce(
  (total, comparison) => total + comparison.dimensions.length,
  0,
);

interface Prompt {
  /** The question a field campaign would be built around. */
  question: string;
  /** What the pipeline already holds, and what it does not settle. */
  evidence: string;
}

interface Track {
  id: string;
  /** Which of the five lines of investigation this is. */
  kind: string;
  title: string;
  aim: string;
  prompts: Prompt[];
}

const TRACKS: Track[] = [
  {
    id: 'mobility',
    kind: 'Line 01',
    title: 'Terrain & Mobility',
    aim: 'Could this terrain help researchers investigate rover mobility on comparable landforms? Slope, roughness and elevation are what a navigation study would actually test.',
    prompts: [
      {
        question: 'Does the terrain stay inside a drive envelope cell by cell, or only on average?',
        evidence: `The Atacama sample reports ${atacama}. Jezero reads ${jezero}. The pixel sizes differ by more than an order of magnitude, so part of the gap between those numbers is terrain and part is resolution — the comparison needs one baseline before either can be read as "drivable".`,
      },
      {
        question: 'How much of the ground is rough enough to cost wheel slip, and can a route avoid it?',
        evidence: `TRI roughness is the closest mobility proxy the pipeline carries: ${earth ? `${earth.roughnessMeanM.toFixed(1)} m mean over ${earth.rows.toLocaleString('en-US')} cells` : 'no value for this build'} on Earth against ${mars ? `${mars.roughnessMeanM.toFixed(1)} m` : 'an unpublished figure'} on Mars. At ${targetResolution('mars')} the Mars figure measures the pixel as much as the ground.`,
      },
      {
        question: 'What can only be measured on foot: bearing strength, embedded rock, slope at wheel scale?',
        evidence: `Nothing in the dataset catalogue measures bearing strength, and the native 30 m SRTM product is already averaged to ${candidateResolution} here. A penetrometer transect and close-range photogrammetry at the analogue close that gap at a fraction of the cost of the same work on Mars.`,
      },
    ],
  },
  {
    id: 'geology',
    kind: 'Line 02',
    title: 'Geology & Materials',
    aim: 'Do the available geological maps or spectral observations indicate comparable surface materials? That question sets the follow-up observations any claim would need.',
    prompts: [
      {
        question: 'Does the geological crosswalk survive contact with the ground?',
        evidence: `Surface geology is ${verdictPair(
          'surface_geology',
        )} — and the engine's own uncertainty list says the crosswalk was drafted from map-group names, with unit descriptions unverified. Field mapping at the analogue is what turns those names into units.`,
      },
      {
        question: 'Which spectral observations would settle the material match?',
        evidence: `The catalogue holds no spectrometer or mineralogy product: MODIS land cover is a 500 m class map, and Diviner measures rock abundance rather than composition. Visible–near-infrared spectra from the site are the missing measurement, not another map layer.`,
      },
      {
        question: 'Would a mineralogy claim rest on a sample or on a score?',
        evidence: `Mineralogy in this app is derived from the model's feature contributions, so it is an inference about the site, not a measurement of it. A material claim should cite a sample and its spectrum; until one exists, the pillar is a prioritisation aid.`,
      },
    ],
  },
  {
    id: 'environment',
    kind: 'Line 03',
    title: 'Environmental Processes',
    aim: 'Could this location support studies of dust, wind, erosion, volcanic activity or sedimentation under Earth-comparable processes?',
    prompts: [
      {
        question: 'Is the site’s dust cycle regular enough to time an experiment against?',
        evidence: `MODIS Terra land-surface temperature arrives at 1 km on 8-day composites, and TES thermal inertia at about 3 km with 60% real coverage between 80°S and 80°N. The engine's thermal verdict is ${verdictPair(
          'temperature_thermal',
        )} — the evidence is missing, not the similarity.`,
      },
      {
        question: 'Does the site record erosion over seasons, or only over megayears?',
        evidence: `Every terrain figure here is a single epoch — SRTM in February 2000, MOLA across 1997–2001, LOLA from 2009 — so slope and roughness are states, not rates. A repeat survey, by drone photogrammetry or a second DEM epoch, is the measurement that turns them into one.`,
      },
      {
        question: 'Which process does this site stand in for — wind, water or volcanism?',
        evidence: `The terrain family is a model label, not a process measurement: nothing in the catalogue records sediment flux, wind speed or eruption history. Field mapping and a sediment trap are what establish which process the analogue can actually test.`,
      },
    ],
  },
  {
    id: 'resources',
    kind: 'Line 04',
    title: 'Resources & Subsurface',
    aim: 'Are there measurable indicators relevant to water, ice, permafrost, caves or lava tubes? This is where the evidence boundary for resource claims runs.',
    prompts: [
      {
        question: 'What can the catalogue say about the subsurface at all?',
        evidence: `Nothing below the surface: the ten catalogued datasets are elevation grids, thermal inertia, rock abundance, land cover and a metadata API. Slope and roughness describe the top layer only, so water, ice or void claims start outside the evidence the pipeline holds.`,
      },
      {
        question: 'Where is the nearest proxy for caves and lava tubes?',
        evidence: `The terrain families include caves, but no dataset resolves a void. Diviner's rock abundance at roughly 950 m/px stops at 60°S–60°N, which excludes the polar ground a lunar base would occupy — the proxy is missing exactly where the question matters most.`,
      },
      {
        question: 'What would move a resource claim from hypothesis to evidence?',
        evidence: `A subsurface instrument — ground-penetrating radar or a neutron spectrometer — is not in the catalogue, so any ice or permafrost statement about this site should be labelled a hypothesis. Naming the instrument that would test it is the honest deliverable.`,
      },
    ],
  },
  {
    id: 'prep',
    kind: 'Line 05',
    title: 'Human & Robotic Prep',
    aim: 'Could this environment support instrument testing, field procedures or robotics research? And which planetary conditions cannot transfer at all?',
    prompts: [
      {
        question: 'Which field procedures actually rehearse here?',
        evidence: `Sampling, instrument deployment and traverse planning do; gravity, atmosphere, day length and radiation do not. A procedure proven at the analogue is proven only for the parts that do not depend on those four, and saying so is part of the result.`,
      },
      {
        question: 'Which instrument can be validated against real numbers at this site?',
        evidence: `Elevation, slope and roughness are measured values with a published citation, over ${earth ? `${earth.rows.toLocaleString('en-US')} valid cells` : 'a documented grid'}, so a DEM-referenced instrument can be checked against them. Thermal and mineralogical instruments cannot yet: ${thin.length} of ${dimensionTotal} engine checks return insufficient evidence (${thinLabels.join(
          ', ',
        )}).`,
      },
      {
        question: 'Can a crew get there, and does the journey fit a field season?',
        evidence: `The gate airport and the modelled cheapest and fastest routes are already in the app under Plan my trip. A site with no commercial access is not a rehearsal site however good its terrain, because reaching it is part of whether an environment supports field work.`,
      },
    ],
  },
];

export function InvestigationPrompts() {
  return (
    <section className="investigations" aria-labelledby="investigations-title">
      <header className="investigations-head">
        <p className="investigations-kicker">Evidence-based investigation prompts</p>
        <h2 id="investigations-title">What an analogue site could be used for</h2>
        <p className="investigations-lede">
          Five lines of investigation the pipeline's own measurements can support — each prompt
          starts from a number or a verdict that already exists, states what it does not settle, and
          names the field work that would.
        </p>
      </header>

      <div className="investigations-grid">
        {TRACKS.map((track) => (
          <article key={track.id} className="investigation">
            <header className="investigation-head">
              <span className="investigation-kind">{track.kind}</span>
              <h3>{track.title}</h3>
              <p className="investigation-aim">{track.aim}</p>
            </header>
            <ol className="investigation-prompts">
              {track.prompts.map((prompt) => (
                <li key={prompt.question}>
                  <p className="investigation-question">{prompt.question}</p>
                  <p className="investigation-evidence">
                    <span className="investigation-tag">Evidence</span>
                    {prompt.evidence}
                  </p>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>

      <p className="investigations-foot">
        These are proposals, not findings. No campaign has been run at any site in this list, and
        the analog scores remain model estimates; the statistics quoted above are the pipeline's
        own measurements from SRTM, MOLA and LOLA.
      </p>
    </section>
  );
}
