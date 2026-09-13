'use client';

import { useEffect, useState } from 'react';
import type { SessionSummary } from '@/lib/types';
import { fromDateInputValue, toDateInputValue } from '@/lib/format';
import { Modal } from './ui/Modal';

interface EditSessionDialogProps {
  open: boolean;
  session: Pick<SessionSummary, 'title' | 'sessionDate'> | null;
  onClose: () => void;
  onSubmit: (changes: { title: string; sessionDate: string | null }) => void;
}

/** Edits the two things about a session that aren't the transcript: its title and its date. */
export function EditSessionDialog({ open, session, onClose, onSubmit }: EditSessionDialogProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');

  // The dialog stays mounted between uses, so reset when it reopens — otherwise
  // it shows whichever session was edited last.
  useEffect(() => {
    if (!open) return;
    setTitle(session?.title ?? '');
    setDate(toDateInputValue(session?.sessionDate ?? null));
  }, [open, session]);

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
