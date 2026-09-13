'use client';

import { useEffect, useState } from 'react';
import type { ClientWithSessions, SessionSummary } from '@/lib/types';
import { Modal } from './ui/Modal';

interface MoveSessionDialogProps {
  open: boolean;
  session: SessionSummary | null;
  clients: ClientWithSessions[];
  onClose: () => void;
  onSubmit: (clientId: string) => void;
}

/**
 * Moves a session between clients.
 *
 * A picker rather than drag-and-drop: misfiling a session under the wrong
 * client is a mistake worth making hard to do by accident, and a select is
 * keyboard-accessible for free.
 */
export function MoveSessionDialog({ open, session, clients, onClose, onSubmit }: MoveSessionDialogProps) {
  const currentClientId = clients.find((client) => client.sessions.some((item) => item.id === session?.id))?.id ?? '';
  const [selected, setSelected] = useState(currentClientId);

  useEffect(() => {
    if (open) setSelected(currentClientId);
  }, [open, currentClientId]);

  const unchanged = selected === currentClientId;

  return (
    <Modal
      open={open}
      title="Move session"
      description={session ? `Move "${session.title}" to a different client.` : undefined}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!selected || unchanged) return;
          onSubmit(selected);
          onClose();
        }}
      >
        <label className="label" htmlFor="move-target">
          Client
        </label>
        <select
          id="move-target"
          className="field"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
              {client.id === currentClientId ? ' (current)' : ''}
            </option>
          ))}
        </select>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={unchanged || !selected}>
            Move session
          </button>
        </div>
      </form>
    </Modal>
  );
}
