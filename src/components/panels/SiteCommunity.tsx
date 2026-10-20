import { useRef, useState } from 'react';
import type { CommunityState } from '../../data-contracts/types';
import { hasVoted, notesFor, reviewsFor, votesFor } from '../../lib/community';
import { readPhotoFile } from '../../lib/photoUpload';

export interface NoteInput {
  author: string;
  observedAt: string;
  text: string;
  photoUrl?: string;
}

export interface ReviewInput {
  author: string;
  text: string;
}

/**
 * Community writes bound to one site. The dossier owns the site id, so the
 * actions it hands down do not repeat it.
 */
export interface CommunityActions {
  onVote: () => void;
  onAddNote: (input: NoteInput) => void;
  onAddReview: (input: ReviewInput) => void;
  onDelete: (kind: 'notes' | 'reviews', id: string) => void;
}

interface SiteCommunityProps {
  siteId: string;
  siteName: string;
  community: CommunityState;
  onVote: (siteId: string) => void;
  onAddNote: (input: NoteInput) => void;
  onAddReview: (input: ReviewInput) => void;
  onDelete: (kind: 'notes' | 'reviews', id: string) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

const shortDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
};

/**
 * Researcher contributions for one site: an upvote anyone can cast once per
 * browser, dated field notes (with an optional uploaded photo), and short
 * reviews.
 *
 * Everything here is stored in this browser unless a shared backend is
 * configured, and the copy says so rather than implying a community of users
 * that is not there yet. Records written elsewhere are never shown with a
 * delete button — you can only remove what this browser added.
 */
export function SiteCommunity({
  siteId,
  siteName,
  community,
  onVote,
  onAddNote,
  onAddReview,
  onDelete,
}: SiteCommunityProps) {
  const [tab, setTab] = useState<'notes' | 'reviews'>('notes');
  const [note, setNote] = useState({ author: '', observedAt: today(), text: '', photoUrl: '' });
  const [review, setReview] = useState({ author: '', text: '' });
  const [problem, setProblem] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const notes = notesFor(community, siteId);
  const reviews = reviewsFor(community, siteId);
  const votes = votesFor(community, siteId);
  const voted = hasVoted(community, siteId);

  function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (note.author.trim().length < 2 || note.text.trim().length < 10) {
      setProblem('Notes need a name and at least 10 characters of observation.');
      return;
    }
    setProblem(null);
    onAddNote({
      author: note.author,
      observedAt: note.observedAt,
      text: note.text,
      photoUrl: note.photoUrl || undefined,
    });
    setNote({ author: note.author, observedAt: today(), text: '', photoUrl: '' });
    setPhotoName('');
  }

  /**
   * The photo travels with the note as a data URL, so it is downscaled before
   * it reaches the store. Reading is async: the form stays usable and says so.
   */
  async function pickPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset first, so choosing the same file again still fires a change event.
    event.target.value = '';
    if (!file) return;

    setPhotoBusy(true);
    try {
      const dataUrl = await readPhotoFile(file);
      setNote((current) => ({ ...current, photoUrl: dataUrl }));
      setPhotoName(file.name);
      setProblem(null);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'That photo could not be read.');
    } finally {
      setPhotoBusy(false);
    }
  }

  function clearPhoto() {
    setNote((current) => ({ ...current, photoUrl: '' }));
    setPhotoName('');
    photoInputRef.current?.focus();
  }

  function addReview(event: React.FormEvent) {
    event.preventDefault();
    if (review.author.trim().length < 2 || review.text.trim().length < 5) {
      setProblem('Reviews need a name and at least 5 characters.');
      return;
    }
    setProblem(null);
    onAddReview({ author: review.author, text: review.text });
    setReview({ author: review.author, text: '' });
  }

  return (
    <section className="community" aria-label={`Community signal for ${siteName}`}>
      <div className="community-head">
        <h3 className="section-title">Researcher signal</h3>
        <button
          type="button"
          className={voted ? 'btn btn-small upvote is-on' : 'btn btn-small upvote'}
          aria-pressed={voted}
          onClick={() => onVote(siteId)}
          title={voted ? 'Remove your upvote' : 'Upvote this site'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5l7 8h-4v6H9v-6H5z" />
          </svg>
          {votes.length} {votes.length === 1 ? 'upvote' : 'upvotes'}
        </button>
      </div>

      <div className="community-tabs" role="tablist" aria-label="Community contributions">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'notes'}
          className={tab === 'notes' ? 'community-tab is-active' : 'community-tab'}
          onClick={() => setTab('notes')}
        >
          Field notes <span className="tab-count">{notes.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'reviews'}
          className={tab === 'reviews' ? 'community-tab is-active' : 'community-tab'}
          onClick={() => setTab('reviews')}
        >
          Reviews <span className="tab-count">{reviews.length}</span>
        </button>
      </div>

      {tab === 'notes' ? (
        <div className="community-panel">
          <form className="community-form" onSubmit={addNote}>
            <div className="community-form-row">
              <label className="mini-field">
                <span>Observer</span>
                <input
                  value={note.author}
                  onChange={(event) => setNote({ ...note, author: event.target.value })}
                  placeholder="Your name"
                  aria-label="Note author"
                />
              </label>
              <label className="mini-field">
                <span>Observed</span>
                <input
                  type="date"
                  value={note.observedAt}
                  onChange={(event) => setNote({ ...note, observedAt: event.target.value })}
                  aria-label="Observation date"
                />
              </label>
            </div>
            <label className="mini-field">
              <span>Observation</span>
              <textarea
                rows={2}
                value={note.text}
                onChange={(event) => setNote({ ...note, text: event.target.value })}
                placeholder="What did you see, sample or measure here?"
                aria-label="Field note"
              />
            </label>
            <div className="photo-field">
              <span className="photo-field-label">Photo · optional</span>
              <div className="photo-field-row">
                <label className={photoBusy ? 'btn btn-small photo-pick is-busy' : 'btn btn-small photo-pick'}>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="photo-input"
                    onChange={pickPhoto}
                    disabled={photoBusy}
                    aria-label="Attach a photo to this field note"
                  />
                  {photoBusy ? 'Preparing…' : note.photoUrl ? 'Replace photo' : 'Choose photo'}
                </label>
                {photoName ? <span className="photo-field-name">{photoName}</span> : null}
                {note.photoUrl ? (
                  <button type="button" className="link-btn" onClick={clearPhoto}>
                    Remove
                  </button>
                ) : null}
              </div>
              {note.photoUrl ? (
                <img
                  className="photo-preview"
                  src={note.photoUrl}
                  alt="Preview of the photo attached to this note"
                />
              ) : null}
            </div>
            <div className="community-add">
              <button type="submit" className="btn btn-small btn-primary">
                Add field note
              </button>
            </div>
          </form>

          {notes.length === 0 ? (
            <p className="community-empty">No field notes on this site yet.</p>
          ) : (
            <ul className="community-list">
              {notes.map((entry) => (
                <li key={entry.id} className="community-item">
                  <div className="community-item-head">
                    <span className="community-author">{entry.author}</span>
                    <span className="community-date">{shortDate(entry.observedAt)}</span>
                  </div>
                  <p>{entry.text}</p>
                  {entry.photoUrl ? (
                    entry.photoUrl.startsWith('data:') ? (
                      <img
                        className="community-photo"
                        src={entry.photoUrl}
                        alt={`Photo attached to ${entry.author}'s field note`}
                        loading="lazy"
                      />
                    ) : (
                      <a
                        className="community-photo"
                        href={entry.photoUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={entry.photoUrl}
                          alt={`Photo attached to ${entry.author}'s field note`}
                          loading="lazy"
                        />
                      </a>
                    )
                  ) : null}
                  {entry.source === 'local' ? (
                    <div className="community-item-foot">
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => onDelete('notes', entry.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="community-panel">
          <form className="community-form" onSubmit={addReview}>
            <label className="mini-field">
              <span>Reviewer</span>
              <input
                value={review.author}
                onChange={(event) => setReview({ ...review, author: event.target.value })}
                placeholder="Your name"
                aria-label="Review author"
              />
            </label>
            <label className="mini-field">
              <span>Assessment</span>
              <textarea
                rows={2}
                value={review.text}
                onChange={(event) => setReview({ ...review, text: event.target.value })}
                placeholder="Does this site hold up as an analog, and why?"
                aria-label="Review text"
              />
            </label>
            <div className="community-add">
              <button type="submit" className="btn btn-small btn-primary">
                Post review
              </button>
            </div>
          </form>

          {reviews.length === 0 ? (
            <p className="community-empty">No reviews yet.</p>
          ) : (
            <ul className="community-list">
              {reviews.map((entry) => (
                <li key={entry.id} className="community-item">
                  <div className="community-item-head">
                    <span className="community-author">{entry.author}</span>
                    <span className="community-date">{shortDate(entry.createdAt)}</span>
                  </div>
                  <p>{entry.text}</p>
                  {entry.source === 'local' ? (
                    <div className="community-item-foot">
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => onDelete('reviews', entry.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {problem ? (
        <p className="community-problem" role="alert">
          {problem}
        </p>
      ) : null}

      <p className="community-note">
        Upvotes, notes and reviews are stored in this browser until a shared backend is configured.
      </p>
    </section>
  );
}
