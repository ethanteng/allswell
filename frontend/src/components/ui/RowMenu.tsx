'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface RowMenuAction {
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  destructive?: boolean;
}

/**
 * The "…" menu on client and session rows.
 *
 * Rendered inline rather than in a portal, so it is clipped by the sidebar's
 * scroll container — acceptable because the menus are short and the sidebar is
 * tall. If menus grow, this needs a portal.
 */
export function RowMenu({ label, actions }: { label: string; actions: RowMenuAction[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          // Rows are themselves buttons; without this the click selects the row.
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="grid h-8 w-8 place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white focus-visible:ring-offset-ink"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-xl border border-ink/10 bg-surface py-1 shadow-[0_16px_40px_rgba(23,37,31,0.28)]"
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                action.onSelect();
              }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition hover:bg-sage-50 ${
                action.destructive ? 'text-clay-700 hover:bg-clay-50' : 'text-ink'
              }`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
