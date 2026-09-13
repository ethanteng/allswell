'use client';

import { useEffect, useState } from 'react';
import { Modal } from './ui/Modal';

interface RenameDialogProps {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  initialValue: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

/** Single-text-field dialog, used for renaming clients and sessions and for adding a client. */
export function RenameDialog({
  open,
  title,
  description,
  label,
  initialValue,
  submitLabel = 'Save',
  onClose,
  onSubmit,
}: RenameDialogProps) {
  const [value, setValue] = useState(initialValue);

  // The dialog stays mounted between uses, so reset when it reopens against a
  // different row — otherwise it shows the previous row's name.
  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const trimmed = value.trim();

  return (
    <Modal open={open} title={title} description={description} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!trimmed) return;
          onSubmit(trimmed);
          onClose();
        }}
      >
        <label className="label" htmlFor="rename-input">
          {label}
        </label>
        <input
          id="rename-input"
          className="field"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={200}
        />

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!trimmed}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
