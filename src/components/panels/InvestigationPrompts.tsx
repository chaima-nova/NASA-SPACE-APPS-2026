import { engineComparisons, measuredTerrain } from '../../services/pipeline';

/**
 * Evidence-based investigation prompts.
 *
 * Finding an analogue is only half the challenge: an analogue is worth
 * publishing because somebody could go and test something there. This section
 * turns the three practical applications the proposal names — rover mobility
 * testing, dust and erosion studies, and instrument validation — into questions
 * a field campaign could answer, and names the measurement each one needs.
 *
 * Every number and verdict below is read from the pipeline at build time: the
 * measured terrain statistics in `data/samples/*_stats.json` and the engine's
 * comparison reports in `reports/*.json`. Nothing here is a result. These are
 * prompts, deliberately paired with the evidence that makes them answerable and
 * the gap that makes them worth doing.
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
 * The measured baselines, each formatted once. These are real statistics from
 * SRTM, MOLA and LOLA — quoted so a reader can see how thin the evidence is
 * next to the confidence a single score invites.
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

/** Every dimension check that the reports still call INSUFFICIENT_EVIDENCE. */
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
  /** Application area, shown above the title. */
  kind: string;
  title: string;
  aim: string;
  prompts: Prompt[];
}

const TRACKS: Track[] = [
  {
    id: 'mobility',
    kind: 'Application 01',
    title: 'Rover mobility testing',
    aim: 'Ground that reads as walkable at the resolution we hold it is not the same as ground a wheel can cross. These prompts separate the two.',
    prompts: [
      {
        question: 'Does the site stay inside the drive envelope cell by cell, or only on average?',
        evidence: `The Atacama sample reports ${atacama}. Jezero reads ${jezero}. The pixel sizes differ by more than an order of magnitude, so part of the gap between those numbers is terrain and part is resolution — the comparison has to be made on one baseline before either can be read as "drivable".`,
      },
      {
        question: 'How much of the ground is rough enough to cost wheel slip, and can a route avoid it?',
        evidence: `TRI roughness is the closest mobility proxy the pipeline carries: ${earth ? `${earth.roughnessMeanM.toFixed(1)} m mean over ${earth.rows.toLocaleString('en-US')} cells` : 'no value for this build'} on Earth against ${mars ? `${mars.roughnessMeanM.toFixed(1)} m` : 'an unpublished figure'} on Mars. At ${targetResolution('mars')} the Mars figure measures the pixel as much as the ground, so a resampled test — or a metre-scale traverse at the analogue — is what would settle it.`,
      },
      {
        question: 'What can only be learned on the ground: bearing strength, embedded rock, slope at wheel scale?',
        evidence: `Nothing in the dataset catalogue measures bearing strength, and the native 30 m SRTM product is already averaged to ${candidateResolution} here. A penetrometer transect and close-range photogrammetry at the analogue close that gap at a fraction of the cost of the same experiment on Mars — which is the argument for going to the analogue first.`,
      },
    ],
  },
  {
    id: 'dust',
    kind: 'Application 02',
    title: 'Dust & erosion studies',
    aim: 'Dust is the failure mode that decides how long an instrument lasts. An analogue earns its keep when its wind and dust cycle can be watched for the price of a few sensors.',
    prompts: [
      {
        question: "Is the site's dust cycle regular enough to time an experiment against it?",
        evidence: `The Earth side holds MODIS Terra land-surface temperature at 1 km on 8-day composites and MODIS land cover at 500 m; the Mars side holds TES thermal inertia at about 3 km with 60% real coverage between 80°S and 80°N. The engine's thermal verdict is ${verdictPair(
          'temperature_thermal',
        )} — it is reporting that the thermal evidence is not there yet, not that the sites differ.`,
      },
      {
        question: 'Does the site record erosion over seasons, or only over megayears?',
        evidence: `Every terrain figure here comes from a single epoch per body — SRTM in February 2000, MOLA across 1997–2001, LOLA from 2009 — so slope and roughness are states, not rates. A repeat survey, by drone photogrammetry or a second DEM epoch, is the missing measurement, and the analogue is the cheapest place on the list to take it.`,
      },
      {
        question: 'Is the abrasion regime the same, or is the site merely dry?',
        evidence: `Aridity is the easy match and the least useful one: grain size and saltation flux are what wear a lens or a seal. The catalogue's closest proxies are thermal inertia and rock abundance, and Diviner's rock-abundance product stops at 60°S–60°N — which excludes the polar ground a south-pole base would actually stand on.`,
      },
    ],
  },
  {
    id: 'instruments',
    kind: 'Application 03',
    title: 'Instrument validation',
    aim: 'An instrument is trusted once it has been run against ground whose true value is known. The question is which parameter at this site is known well enough to be that reference.',
    prompts: [
      {
        question: 'Which parameters here are measured well enough to calibrate against?',
        evidence: `The Atacama sample is a real measurement with a published citation, ${
          earth ? `${earth.rows.toLocaleString('en-US')} valid cells` : 'a documented grid'
        } and derived slope and roughness — a defensible reference surface. Geology is not: surface geology is ${verdictPair(
          'surface_geology',
        )}, because the crosswalk was drafted from map-group names.`,
      },
      {
        question: 'At what footprint does the instrument sample, and does the analogue resolve that footprint?',
        evidence: `A field spectrometer or rover camera samples metres to tens of metres. The DEM behind this site is ${candidateResolution} and the lunar baseline ${targetResolution(
          'moon',
        )}, so neither can validate a metre-scale sensor on its own: the calibration needs an independent ground-truth transect measured at the scale the instrument actually sees.`,
      },
      {
        question: 'Which engine verdicts are waiting on a field measurement, and what would flip them?',
        evidence: `Of ${dimensionTotal} dimension checks across both targets, ${thin.length} return insufficient evidence (${thinLabels.join(
          ', ',
        )}). Each names a dataset the pipeline has not ingested yet, so the validation plan and the ingestion backlog are the same list — the most useful thing an analogue site can hand a team before launch.`,
      },
    ],
  },
];

export function InvestigationPrompts() {
  return (
    <section className="investigations" aria-labelledby="investigations-title">
      <header className="investigations-head">
        <p className="investigations-kicker">Evidence-based investigation prompts</p>
        <h2 id="investigations-title">What an analogue site lets you test</h2>
        <p className="investigations-lede">
          A candidate earns its place on this list by being somewhere a team could work. Each
          prompt below starts from a measurement the pipeline already holds, states what that
          measurement does not settle, and names the field work that would.
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
