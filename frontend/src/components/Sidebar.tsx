'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  FolderInput,
  GripVertical,
  LogOut,
  Pencil,
  Plus,
  Settings,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useWorkspace } from '@/store/workspace';
import type { AuthUser, ClientWithSessions, SessionSummary } from '@/lib/types';
import { formatSessionDate, relativeTime } from '@/lib/format';
import { Logo } from './Logo';
import { RowMenu } from './ui/RowMenu';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { RenameDialog } from './RenameDialog';
import { EditSessionDialog } from './EditSessionDialog';
import { MoveSessionDialog } from './MoveSessionDialog';

type PendingRename = { kind: 'client'; id: string; current: string };
type PendingDelete = { kind: 'client' | 'session'; id: string; name: string; sessionCount: number };

/** Status dot on a session row. Only non-complete states earn a colour. */
function StatusDot({ status }: { status: SessionSummary['status'] }) {
  if (status === 'COMPLETE') return null;

  const tone =
    status === 'FAILED' ? 'bg-clay-500' : status === 'ANALYZING' ? 'bg-sage-200 animate-pulse' : 'bg-white/30';

  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone}`} aria-hidden />;
}

/**
 * Where the dragged row would land.
 *
 * Absolutely positioned on purpose: a line that occupied layout would shift
 * every row below it as the pointer moves, so the target keeps sliding out from
 * under the cursor.
 */
function DropLine({ visible, edge }: { visible: boolean; edge: 'top' | 'bottom' }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-sage-200 transition-opacity ${
        edge === 'top' ? 'top-0' : 'bottom-0'
      } ${visible ? 'opacity-100' : 'opacity-0'}`}
    />
  );
}

function ClientGroup({
  client,
  onRename,
  onDelete,
  onEditSession,
  onMoveSession,
  onDeleteSession,
  onNewSessionFor,
}: {
  client: ClientWithSessions;
  onRename: (pending: PendingRename) => void;
  onDelete: (pending: PendingDelete) => void;
  onEditSession: (session: SessionSummary) => void;
  onMoveSession: (session: SessionSummary) => void;
  onDeleteSession: (pending: PendingDelete) => void;
  onNewSessionFor: (clientId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const { selectedSessionId, selectSession, reorderSessions } = useWorkspace();

  /** The row being dragged, and the gap it would drop into. */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const order = client.sessions.map((session) => session.id);

  function commit(next: string[]) {
    if (next.length === order.length && next.every((id, index) => id === order[index])) return;
    void reorderSessions(client.id, next);
  }

  /** Moves one session to a gap index, counted in the pre-move list. */
  function moveTo(sessionId: string, gap: number) {
    const from = order.indexOf(sessionId);
    if (from === -1) return;

    const next = [...order];
    next.splice(from, 1);
    // Removing the row shifts every later gap down by one.
    next.splice(gap > from ? gap - 1 : gap, 0, sessionId);
    commit(next);
  }

  function nudge(sessionId: string, delta: -1 | 1) {
    const from = order.indexOf(sessionId);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= order.length) return;

    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    commit(next);
  }

  function endDrag() {
    setDraggingId(null);
    setDropIndex(null);
  }

  return (
    <div className="rounded-xl">
      <div className="group flex items-center gap-1 rounded-lg px-1 py-1.5 hover:bg-white/[0.06]">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1 text-left focus-visible:ring-offset-ink"
        >
          <ChevronDown
            size={14}
            className={`shrink-0 text-white/40 transition-transform ${expanded ? '' : '-rotate-90'}`}
            aria-hidden
          />
          <span className="truncate text-sm font-semibold text-white/90">{client.name}</span>
          <span className="shrink-0 text-xs text-white/35">{client.sessions.length}</span>
        </button>

        <div className="opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <RowMenu
            label={`Actions for ${client.name}`}
            actions={[
              {
                label: 'New session',
                icon: <Plus size={15} />,
                onSelect: () => onNewSessionFor(client.id),
              },
              {
                label: 'Rename client',
                icon: <Pencil size={15} />,
                onSelect: () => onRename({ kind: 'client', id: client.id, current: client.name }),
              },
              {
                label: 'Delete client',
                icon: <Trash2 size={15} />,
                destructive: true,
                onSelect: () =>
                  onDelete({ kind: 'client', id: client.id, name: client.name, sessionCount: client.sessions.length }),
              },
            ]}
          />
        </div>
      </div>

      {expanded && (
        <div
          className="ml-4 border-l border-white/10 pl-2"
          onDragLeave={(event) => {
            // Only when the pointer leaves the list itself, not on the way
            // between two rows inside it.
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropIndex(null);
          }}
          onDrop={endDrag}
        >
          {client.sessions.length === 0 ? (
            <p className="px-2.5 py-2 text-xs leading-5 text-white/35">No sessions yet.</p>
          ) : (
            client.sessions.map((session, index) => {
              const isActive = session.id === selectedSessionId;
              const isDragging = session.id === draggingId;
              const date = formatSessionDate(session.sessionDate);

              return (
                <div key={session.id} className="relative">
                  <DropLine visible={dropIndex === index} edge="top" />

                  <div
                    draggable
                    onDragStart={(event) => {
                      setDraggingId(session.id);
                      event.dataTransfer.effectAllowed = 'move';
                      // Firefox starts no drag at all without payload set.
                      event.dataTransfer.setData('text/plain', session.id);
                    }}
                    onDragEnd={endDrag}
                    onDragOver={(event) => {
                      if (!draggingId) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';

                      // Past the midpoint means the gap below this row.
                      const box = event.currentTarget.getBoundingClientRect();
                      setDropIndex(event.clientY < box.top + box.height / 2 ? index : index + 1);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggingId && dropIndex !== null) moveTo(draggingId, dropIndex);
                      endDrag();
                    }}
                    className={`group flex items-center gap-1 rounded-lg transition ${
                      isDragging ? 'opacity-40' : isActive ? 'bg-white/[0.13]' : 'hover:bg-white/[0.06]'
                    }`}
                  >
                    <span
                      aria-hidden
                      className="grid w-4 shrink-0 cursor-grab place-items-center self-stretch text-white/0 transition group-hover:text-white/25 active:cursor-grabbing"
                    >
                      <GripVertical size={13} />
                    </span>

                    <button
                      type="button"
                      onClick={() => void selectSession(session.id)}
                      aria-current={isActive ? 'true' : undefined}
                      className="min-w-0 flex-1 rounded-lg py-2 pr-1 text-left focus-visible:ring-offset-ink"
                    >
                      <span className="flex items-center gap-1.5">
                        <StatusDot status={session.status} />
                        <span className="line-clamp-2 text-[13px] leading-[18px] text-white/85">{session.title}</span>
                      </span>
                      {/* The session's own date is what a clinician looks for.
                          "3d ago" describes when it was pasted in, which only
                          answers that question by coincidence. */}
                      <span className="mt-0.5 block text-[11px] text-white/35">
                        {date ?? relativeTime(session.createdAt)}
                      </span>
                    </button>

                    <div className="opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                      <RowMenu
                        label={`Actions for ${session.title}`}
                        actions={[
                          {
                            label: 'Edit session',
                            icon: <Pencil size={15} />,
                            onSelect: () => onEditSession(session),
                          },
                          // Dragging is the obvious way to reorder and the one
                          // nobody can do from a keyboard.
                          {
                            label: 'Move up',
                            icon: <ArrowUp size={15} />,
                            disabled: index === 0,
                            onSelect: () => nudge(session.id, -1),
                          },
                          {
                            label: 'Move down',
                            icon: <ArrowDown size={15} />,
                            disabled: index === client.sessions.length - 1,
                            onSelect: () => nudge(session.id, 1),
                          },
                          {
                            label: 'Move to client…',
                            icon: <FolderInput size={15} />,
                            onSelect: () => onMoveSession(session),
                          },
                          {
                            label: 'Delete session',
                            icon: <Trash2 size={15} />,
                            destructive: true,
                            onSelect: () =>
                              onDeleteSession({ kind: 'session', id: session.id, name: session.title, sessionCount: 0 }),
                          },
                        ]}
                      />
                    </div>
                  </div>

                  {index === client.sessions.length - 1 && (
                    <DropLine visible={dropIndex === client.sessions.length} edge="bottom" />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ user, onSignOut, onClose }: { user: AuthUser | null; onSignOut: () => void; onClose?: () => void }) {
  const {
    clients,
    loadingClients,
    startNewSession,
    createClient,
    renameClient,
    deleteClient,
    editSession,
    moveSession,
    deleteSession,
  } = useWorkspace();

  const [rename, setRename] = useState<PendingRename | null>(null);
  const [editingSession, setEditingSession] = useState<SessionSummary | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [movingSession, setMovingSession] = useState<SessionSummary | null>(null);
  const [addingClient, setAddingClient] = useState(false);

  const totalSessions = clients.reduce((count, client) => count + client.sessions.length, 0);

  /**
   * "New session" from a client's own menu preselects that client in the
   * composer, which is the difference between filing a session and re-filing it
   * afterwards.
   */
  function newSessionFor(clientId: string) {
    startNewSession(clientId);
    onClose?.();
  }

  return (
    <>
      <aside className="flex h-full w-full flex-col bg-ink text-white lg:w-[288px]">
        {/* The mobile header carries its own logo, so this one is desktop-only. */}
        <div className="hidden h-16 items-center px-5 text-white lg:flex">
          <Logo tone="light" />
        </div>

        <div className="space-y-1.5 px-3 pb-3">
          <button
            type="button"
            onClick={() => {
              startNewSession();
              onClose?.();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl bg-sage-100 px-4 py-3 text-sm font-semibold text-ink transition hover:bg-white focus-visible:ring-offset-ink"
          >
            <Plus size={17} />
            New session
          </button>

          <button
            type="button"
            onClick={() => setAddingClient(true)}
            className="flex w-full items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm text-white/65 transition hover:bg-white/10 hover:text-white focus-visible:ring-offset-ink"
          >
            <UserPlus size={16} />
            Add client
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/10 px-3 py-4">
          <div className="mb-2 flex items-center justify-between px-2">
            <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">
              <Users size={13} />
              Clients
            </h2>
            <span className="text-[11px] text-white/30">
              {clients.length} · {totalSessions} session{totalSessions === 1 ? '' : 's'}
            </span>
          </div>

          {loadingClients && clients.length === 0 ? (
            <p className="px-2 text-sm text-white/40">Loading…</p>
          ) : clients.length === 0 ? (
            <p className="px-2 text-sm leading-6 text-white/40">
              No clients yet. Paste a transcript and one will be created for you.
            </p>
          ) : (
            <div className="space-y-0.5">
              {clients.map((client) => (
                <ClientGroup
                  key={client.id}
                  client={client}
                  onRename={setRename}
                  onDelete={setPendingDelete}
                  onEditSession={setEditingSession}
                  onMoveSession={setMovingSession}
                  onDeleteSession={setPendingDelete}
                  onNewSessionFor={newSessionFor}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 p-4">
          {user?.isAdmin && (
            <Link
              href="/admin"
              className="mb-3 flex items-center gap-2 text-sm text-white/65 transition hover:text-white focus-visible:ring-offset-ink"
            >
              <Settings size={15} />
              Admin
            </Link>
          )}
          <div className="mb-2.5 truncate text-xs text-white/40">{user?.email}</div>
          <button
            type="button"
            onClick={onSignOut}
            className="flex items-center gap-2 text-sm text-white/65 transition hover:text-white focus-visible:ring-offset-ink"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      <RenameDialog
        open={rename !== null}
        title="Rename client"
        description="Use the name you would recognise this person by."
        label="Client name"
        initialValue={rename?.current ?? ''}
        onClose={() => setRename(null)}
        onSubmit={(value) => {
          if (rename) void renameClient(rename.id, value);
        }}
      />

      <EditSessionDialog
        open={editingSession !== null}
        session={editingSession}
        onClose={() => setEditingSession(null)}
        onSubmit={(changes) => {
          if (editingSession) void editSession(editingSession.id, changes);
        }}
      />

      <RenameDialog
        open={addingClient}
        title="Add a client"
        description="Sessions can be filed under this client as you add them."
        label="Client name"
        submitLabel="Add client"
        initialValue=""
        onClose={() => setAddingClient(false)}
        onSubmit={(value) => void createClient(value)}
      />

      <MoveSessionDialog
        open={movingSession !== null}
        session={movingSession}
        clients={clients}
        onClose={() => setMovingSession(null)}
        onSubmit={(clientId) => {
          if (movingSession) void moveSession(movingSession.id, clientId);
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.kind === 'client' ? 'Delete this client?' : 'Delete this session?'}
        description={
          pendingDelete?.kind === 'client'
            ? `"${pendingDelete.name}" and its ${pendingDelete.sessionCount} session${
                pendingDelete.sessionCount === 1 ? '' : 's'
              } will be permanently deleted, transcripts included. This cannot be undone.`
            : `"${pendingDelete?.name}" and its feedback will be permanently deleted. This cannot be undone.`
        }
        confirmLabel={pendingDelete?.kind === 'client' ? 'Delete client' : 'Delete session'}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          if (pendingDelete.kind === 'client') void deleteClient(pendingDelete.id);
          else void deleteSession(pendingDelete.id);
        }}
      />
    </>
  );
}
