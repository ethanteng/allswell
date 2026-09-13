'use client';

import { useEffect, useRef, useState } from 'react';
import type { SessionSummary } from '@/lib/types';
import { fromDateInputValue, toDateInputValue } from '@/lib/format';
import { Modal } from './ui/Modal';

interface EditSessionDialogProps {
  open: boolean;
  session: Pick<SessionSummary, 'id' | 'title' | 'sessionDate'> | null;
  onClose: () => void;
  onSubmit: (changes: { title: string; sessionDate: string | null }) => void;
}

/** Edits the two things about a session that aren't the transcript: its title and its date. */
export function EditSessionDialog({ open, session, onClose, onSubmit }: EditSessionDialogProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');

  // Read through a ref so the reset below can depend on the session's identity
  // rather than on the object, which is replaced wholesale on every refresh.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const sessionId = session?.id ?? null;

  /**
   * Seed the fields when the dialog opens, or when it is pointed at a different
   * session while open.
   *
   * Deliberately not keyed on the session object: anything that reloads the
   * open session — an analysis or follow-up finishing, a re-run — replaces it
   * with a new object holding identical title and date, and resetting on that
   * would wipe whatever the clinician had typed. Those requests can be in
   * flight while this dialog is open, so it is reachable, and the failure is
   * silent: the draft is simply gone.
   */
  useEffect(() => {
    if (!open) return;
    const current = sessionRef.current;
    setTitle(current?.title ?? '');
    setDate(toDateInputValue(current?.sessionDate ?? null));
  }, [open, sessionId]);

  const trimmed = title.trim();

  return (
    <Modal
      open={open}
      title="Edit session"
      description="Rename this session, or set the date it took place."
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!trimmed) return;
          onSubmit({ title: trimmed, sessionDate: fromDateInputValue(date) });
          onClose();
        }}
      >
        <label className="label" htmlFor="edit-session-title">
          Session title
        </label>
        <input
          id="edit-session-title"
          className="field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
        />

        <label className="label mt-4" htmlFor="edit-session-date">
          Session date <span className="font-normal text-ink-faint">(optional)</span>
        </label>
        <input
          id="edit-session-date"
          type="date"
          className="field"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        {date && (
          <button
            type="button"
            onClick={() => setDate('')}
            className="mt-2 text-xs font-medium text-ink-muted underline underline-offset-2 hover:text-ink"
          >
            Clear date
          </button>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!trimmed}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
