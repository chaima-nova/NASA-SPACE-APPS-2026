import { useState } from 'react';
import type { CommunityState } from '../../data-contracts/types';
import { hasVoted, notesFor, reviewsFor, votesFor } from '../../lib/community';

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
 * browser, dated field notes, and short reviews.
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
    if (note.photoUrl.trim()) {
      try {
        const url = new URL(note.photoUrl.trim());
        if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('scheme');
      } catch {
        setProblem('The photo link must be a full http(s) URL.');
        return;
      }
    }
    setProblem(null);
    onAddNote({
      author: note.author,
      observedAt: note.observedAt,
      text: note.text,
      photoUrl: note.photoUrl || undefined,
    });
    setNote({ author: note.author, observedAt: today(), text: '', photoUrl: '' });
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
            <label className="mini-field">
              <span>Photo link · optional</span>
              <input
                value={note.photoUrl}
                onChange={(event) => setNote({ ...note, photoUrl: event.target.value })}
                placeholder="https://…"
                aria-label="Field note photo link"
              />
            </label>
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
                  <div className="community-item-foot">
                    {entry.photoUrl ? (
                      <a href={entry.photoUrl} target="_blank" rel="noreferrer">
                        photo
                      </a>
                    ) : null}
                    {entry.source === 'local' ? (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => onDelete('notes', entry.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
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
