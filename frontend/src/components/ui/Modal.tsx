'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ open, title, description, onClose, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // Move focus into the dialog so keyboard users aren't left behind on the
    // page underneath, and wire Escape to close.
    panelRef.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4 py-8">
      <div className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card relative w-full max-w-md p-6 shadow-[0_24px_70px_rgba(23,37,31,0.22)]"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em]">{title}</h2>
            {description && <p className="mt-1 text-sm leading-6 text-ink-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-ink/5"
          >
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
