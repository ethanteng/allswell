'use client';

import { useState } from 'react';
import { CircleAlert, Clock, FolderInput, LoaderCircle, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/store/workspace';
import type { SessionDetail } from '@/lib/types';
import { formatSessionDate } from '@/lib/format';
import { FeedbackPanel } from './FeedbackPanel';
import { FollowUpThread } from './FollowUpThread';
import { TranscriptView } from './TranscriptView';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { EditSessionDialog } from './EditSessionDialog';
import { MoveSessionDialog } from './MoveSessionDialog';

type Tab = 'feedback' | 'transcript';

export function SessionView({ session }: { session: SessionDetail }) {
  const { clients, working, error, reanalyze, editSession, moveSession, deleteSession } = useWorkspace();

  const [tab, setTab] = useState<Tab>('feedback');
  const [highlight, setHighlight] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const analysisTurn = session.turns.find((turn) => turn.kind === 'ANALYSIS');
  const feedback = analysisTurn?.feedback ?? null;
  const sessionDate = formatSessionDate(session.sessionDate);

  /** A citation click jumps to the transcript tab and scrolls to the line. */
  function handleCite(timestamp: string) {
    setTab('transcript');
    setHighlight(timestamp);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
          <span className="font-semibold text-ink">{session.client.name}</span>
          {sessionDate && (
            <>
              <span aria-hidden className="text-ink-faint">
                ·
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={13} aria-hidden />
                {sessionDate}
              </span>
            </>
          )}
          {analysisTurn?.model && (
            <>
              <span aria-hidden className="text-ink-faint">
                ·
              </span>
              <span className="font-mono text-[11px] text-ink-faint">
                {analysisTurn.model}
                {analysisTurn.promptVersion !== null ? ` · prompt v${analysisTurn.promptVersion}` : ''}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="max-w-xl text-2xl font-semibold leading-9 tracking-[-0.03em]">{session.title}</h1>

          <div className="flex flex-wrap gap-1">
            <button type="button" className="btn-ghost px-3 text-[13px]" onClick={() => void reanalyze()} disabled={working}>
              {working ? <LoaderCircle className="animate-spin" size={15} /> : <RefreshCw size={15} />}
              Re-run
            </button>
            <button type="button" className="btn-ghost px-3 text-[13px]" onClick={() => setEditing(true)}>
              <Pencil size={15} />
              Edit
            </button>
            <button type="button" className="btn-ghost px-3 text-[13px]" onClick={() => setMoving(true)}>
              <FolderInput size={15} />
              Move
            </button>
            <button
              type="button"
              className="btn-ghost px-3 text-[13px] hover:bg-clay-50 hover:text-clay-700"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={15} />
              Delete
            </button>
          </div>
        </div>
      </header>

      {error && (
        <p role="alert" className="mb-5 rounded-xl border border-clay-100 bg-clay-50 px-4 py-3 text-sm text-clay-700">
          {error}
        </p>
      )}

      {session.status === 'FAILED' && (
        <p role="alert" className="mb-5 flex gap-2.5 rounded-xl border border-clay-100 bg-clay-50 p-4 text-sm leading-6 text-clay-700">
          <CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">Analysis failed.</strong>{' '}
            {session.errorMessage ?? 'Something went wrong.'} The transcript is saved — try Re-run.
          </span>
        </p>
      )}

      <div className="mb-6 flex gap-1 border-b border-ink/10" role="tablist" aria-label="Session views">
        {(['feedback', 'transcript'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold capitalize transition ${
              tab === value ? 'border-ink text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {tab === 'feedback' ? (
        <div className="space-y-10">
          {feedback ? (
            <FeedbackPanel feedback={feedback} onCite={handleCite} />
          ) : (
            <p className="rounded-2xl bg-sage-50 p-5 text-sm leading-6 text-ink-muted">
              No feedback has been generated for this session yet. Use Re-run to analyze the transcript.
            </p>
          )}

          {feedback && (
            <FollowUpThread turns={session.turns} suggestions={feedback.suggestedQuestions} />
          )}
        </div>
      ) : (
        <TranscriptView transcript={session.transcript} highlight={highlight} />
      )}

      <EditSessionDialog
        open={editing}
        session={session}
        onClose={() => setEditing(false)}
        onSubmit={(changes) => void editSession(session.id, changes)}
      />

      <MoveSessionDialog
        open={moving}
        session={session}
        clients={clients}
        onClose={() => setMoving(false)}
        onSubmit={(clientId) => void moveSession(session.id, clientId)}
      />

      <ConfirmDialog
        open={deleting}
        title="Delete this session?"
        description={`"${session.title}" and its feedback will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete session"
        onClose={() => setDeleting(false)}
        onConfirm={() => void deleteSession(session.id)}
      />
    </div>
  );
}
