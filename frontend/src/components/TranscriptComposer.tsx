'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, LoaderCircle, Sparkles, Upload } from 'lucide-react';
import { useWorkspace } from '@/store/workspace';
import { SAMPLE_TRANSCRIPTS, loadSample } from '@/lib/samples';

const NEW_CLIENT = '__new__';

/** Enough to be a session rather than a stray paragraph; mirrors the API's rule. */
const MIN_TRANSCRIPT_LENGTH = 50;

export function TranscriptComposer() {
  const { clients, createSession, working, error } = useWorkspace();

  const [transcript, setTranscript] = useState('');
  const [clientId, setClientId] = useState<string>(NEW_CLIENT);
  const [newClientName, setNewClientName] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [loadingSample, setLoadingSample] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * "New session" from a client's sidebar menu preselects that client. An event
   * rather than a store field: it is a one-shot instruction to this component,
   * not state anything else needs to read back.
   */
  useEffect(() => {
    function onComposeForClient(event: Event) {
      const { clientId: target } = (event as CustomEvent<{ clientId: string }>).detail;
      setClientId(target);
    }

    window.addEventListener('allswell:compose-for-client', onComposeForClient);
    return () => window.removeEventListener('allswell:compose-for-client', onComposeForClient);
  }, []);

  // A client selected here can be deleted from the sidebar while the composer
  // is open; fall back rather than posting a clientId that no longer resolves.
  useEffect(() => {
    if (clientId !== NEW_CLIENT && !clients.some((client) => client.id === clientId)) {
      setClientId(NEW_CLIENT);
    }
  }, [clients, clientId]);

  async function handleSample() {
    const sample = SAMPLE_TRANSCRIPTS[0];
    setLoadingSample(true);
    setLocalError(null);

    try {
      setTranscript(await loadSample(sample));
      if (clientId === NEW_CLIENT && !newClientName.trim()) setNewClientName(sample.suggestedClientName);
    } catch {
      setLocalError('Could not load the sample transcript.');
    } finally {
      setLoadingSample(false);
    }
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLocalError(null);
    try {
      setTranscript(await file.text());
    } catch {
      setLocalError('Could not read that file.');
    } finally {
      // Reset so selecting the same file twice in a row still fires onChange.
      event.target.value = '';
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLocalError(null);

    const trimmed = transcript.trim();
    if (trimmed.length < MIN_TRANSCRIPT_LENGTH) {
      setLocalError('That transcript looks too short to analyse.');
      return;
    }

    await createSession({
      transcript: trimmed,
      ...(clientId !== NEW_CLIENT ? { clientId } : {}),
      ...(clientId === NEW_CLIENT && newClientName.trim() ? { newClientName: newClientName.trim() } : {}),
      ...(sessionDate ? { sessionDate: new Date(sessionDate).toISOString() } : {}),
    });
  }

  const shownError = localError ?? error;
  const characterCount = transcript.trim().length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-7">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-sage-600">New session</p>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-[34px]">
          Paste a session transcript.
        </h1>
        <p className="mt-2.5 max-w-xl text-[15px] leading-7 text-ink-muted">
          You&apos;ll get the kind of feedback a senior clinician gives after sitting in on a session — what worked,
          what to try differently, each point tied to the moment it came from.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card overflow-hidden shadow-[0_18px_50px_rgba(23,37,31,0.06)]">
        <div className="border-b border-ink/10 px-5 py-5 sm:px-7">
          <label htmlFor="transcript" className="sr-only">
            Session transcript
          </label>
          <textarea
            id="transcript"
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            disabled={working}
            rows={12}
            className="w-full resize-y bg-transparent text-[15px] leading-7 text-ink outline-none placeholder:text-ink-faint"
            placeholder={'[0:00] Therapist: Hi, Daniel. I can see and hear you. Can you hear me all right?\n\n[0:06] Client: Yeah, I can hear you…'}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-4">
            <button type="button" onClick={handleSample} className="btn-secondary px-4 text-[13px]" disabled={loadingSample || working}>
              {loadingSample ? <LoaderCircle className="animate-spin" size={15} /> : <FileText size={15} />}
              Use sample transcript
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary px-4 text-[13px]"
              disabled={working}
            >
              <Upload size={15} />
              Upload a file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.markdown,text/plain,text/markdown"
              onChange={handleFile}
              className="hidden"
            />

            {characterCount > 0 && (
              <span className="ml-auto text-xs text-ink-faint">{characterCount.toLocaleString()} characters</span>
            )}
          </div>
        </div>

        <div className="grid gap-4 bg-sage-50/60 px-5 py-5 sm:grid-cols-2 sm:px-7">
          <div>
            <label className="label" htmlFor="client-select">
              File under
            </label>
            <select
              id="client-select"
              className="field"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              disabled={working}
            >
              <option value={NEW_CLIENT}>+ New client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>

            {clientId === NEW_CLIENT && (
              <input
                className="field mt-2"
                value={newClientName}
                onChange={(event) => setNewClientName(event.target.value)}
                placeholder="Client name (you can set this later)"
                maxLength={120}
                disabled={working}
                aria-label="New client name"
              />
            )}
          </div>

          <div>
            <label className="label" htmlFor="session-date">
              Session date <span className="font-normal text-ink-faint">(optional)</span>
            </label>
            <input
              id="session-date"
              type="date"
              className="field"
              value={sessionDate}
              onChange={(event) => setSessionDate(event.target.value)}
              disabled={working}
            />
          </div>
        </div>

        {shownError && (
          <p role="alert" className="border-t border-clay-100 bg-clay-50 px-5 py-4 text-sm text-clay-700 sm:px-7">
            {shownError}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 px-5 py-4 sm:px-7">
          <p className="text-xs leading-5 text-ink-faint">
            Feedback covers the clinician only. It does not assess the client.
          </p>
          <button type="submit" className="btn-primary min-w-[180px]" disabled={working || characterCount === 0}>
            {working ? (
              <>
                <LoaderCircle className="animate-spin" size={16} />
                Analysing…
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate feedback
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
