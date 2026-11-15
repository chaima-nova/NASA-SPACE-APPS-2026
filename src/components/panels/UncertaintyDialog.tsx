import { Modal } from '../layout/Modal';
import { SIMILARITY_KIND_LABELS, type DimensionSimilarity } from '../../lib/similarity';
import { TARGET_LABELS, type Target } from '../../lib/site';

interface UncertaintyDialogProps {
  similarity: DimensionSimilarity;
  target: Target;
  onClose: () => void;
}

/**
 * The arithmetic behind one percentage's ±.
 *
 * The dossier prints a number and a budget; a reader who wants to know where the
 * budget came from gets every term here, with the figures it used. Nothing in
 * this dialog asserts a confidence: each term names the substitution or the
 * assumption that produced it, the method says how the terms were combined, and
 * the last paragraph names what was deliberately left out. A prediction repeats
 * that it is one, because the word in the dossier row is easy to skim past.
 */
export function UncertaintyDialog({ similarity, target, onClose }: UncertaintyDialogProps) {
  const { uncertainty, percent, kind, label, basis } = similarity;
  if (percent === null || !uncertainty) return null;

  const shown = Math.round(percent);

  return (
    <Modal
      kicker="Uncertainty budget"
      title={`${shown}% — how the ±${uncertainty.total} points are built`}
      subtitle={`${label}, compared against ${TARGET_LABELS[target]}. ${SIMILARITY_KIND_LABELS[kind]}.`}
      onClose={onClose}
      size="md"
      className="uncertainty-modal"
      footer={
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      }
    >
      <dl className="facts">
        <div>
          <dt>Percentage</dt>
          <dd>{shown}%</dd>
        </div>
        <div>
          <dt>Uncertainty</dt>
          <dd>±{uncertainty.total} points</dd>
        </div>
        <div>
          <dt>Interval</dt>
          <dd>
            {uncertainty.low}–{uncertainty.high}%
          </dd>
        </div>
        <div>
          <dt>Kind</dt>
          <dd>{SIMILARITY_KIND_LABELS[kind]}</dd>
        </div>
      </dl>

      <p className="uncertainty-basis">{basis}</p>

      <h3 className="section-title">
        The budget <span className="section-count">{uncertainty.terms.length}</span>
      </h3>
      <ul className="uncertainty-terms">
        {uncertainty.terms.map((term) => (
          <li key={term.label}>
            <div className="uncertainty-term-head">
              <span className="uncertainty-term">{term.label}</span>
              <span className="uncertainty-points">±{term.points} pts</span>
            </div>
            <p className="uncertainty-detail">{term.detail}</p>
          </li>
        ))}
      </ul>

      <h3 className="section-title">How the terms combine</h3>
      <p className="uncertainty-method">{uncertainty.method}</p>
      <p className="uncertainty-method">{uncertainty.exclusions}</p>

      {kind === 'predicted' ? (
        <p className="uncertainty-caveat">
          This is a prediction, not a measurement of this site — which is why the row that opened
          this dialog is labelled Prediction rather than Measured similarity.
        </p>
      ) : null}
    </Modal>
  );
}
