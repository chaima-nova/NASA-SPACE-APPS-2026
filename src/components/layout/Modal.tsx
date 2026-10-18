import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  /** Small uppercase line above the title. */
  kicker: string;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  /** `lg` is wide enough for side-by-side content (the compare view). */
  size?: 'md' | 'lg';
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Shared dialog shell: backdrop dismiss, Escape, scroll lock, focus moved to
 * the close button on open and trapped inside while open, then restored to
 * whatever opened it. Every modal in the app uses this so those behaviours
 * cannot drift apart.
 */
export function Modal({
  kicker,
  title,
  subtitle,
  onClose,
  size = 'md',
  children,
  footer,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`modal-dialog modal-${size}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
      >
        <header className="modal-head">
          <div>
            <span className="kicker">{kicker}</span>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="modal-body">{children}</div>

        {footer ? <footer className="modal-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}
