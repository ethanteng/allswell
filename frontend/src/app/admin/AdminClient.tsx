'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, LoaderCircle, RotateCcw, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/use-auth';
import type { AdminConfigResponse } from '@/lib/types';

/** Local edits, kept separate from the server copy so Reset has something to compare against. */
interface Draft {
  analysisPrompt: string;
  followUpPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

function toDraft(data: AdminConfigResponse): Draft {
  const { analysisPrompt, followUpPrompt, model, temperature, maxTokens } = data.config;
  return { analysisPrompt, followUpPrompt, model, temperature, maxTokens };
}

export function AdminClient() {
  const { user, checking } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<AdminConfigResponse | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  // A non-admin who lands here gets the same answer as someone who mistyped a
  // URL. The API refuses them regardless; this just avoids a broken page.
  useEffect(() => {
    if (!checking && user && !user.isAdmin) router.replace('/app');
  }, [checking, user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = await api.getAdminConfig();
      setData(config);
      setDraft(toDraft(config));
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load configuration' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.isAdmin) void load();
  }, [user, load]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;

    setSaving(true);
    setStatus(null);

    try {
      const { config } = await api.updateAdminConfig(draft);
      setData((current) => (current ? { ...current, config } : current));
      setStatus({
        kind: 'ok',
        message: `Saved as version ${config.version}. New analyses use it immediately; existing ones keep the version they were generated with until re-run.`,
      });
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Could not save configuration' });
    } finally {
      setSaving(false);
    }
  }

  if (checking || (loading && !draft)) {
    return (
      <main className="grid min-h-screen place-items-center" aria-busy="true">
        <LoaderCircle className="animate-spin text-ink-muted" size={26} />
      </main>
    );
  }

  if (!user?.isAdmin || !draft || !data) return null;

  const dirty =
    draft.analysisPrompt !== data.config.analysisPrompt ||
    draft.followUpPrompt !== data.config.followUpPrompt ||
    draft.model !== data.config.model ||
    draft.temperature !== data.config.temperature ||
    draft.maxTokens !== data.config.maxTokens;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <Link href="/app" className="mb-7 inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft size={16} />
        Back to workspace
      </Link>

      <header className="mb-8">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-sage-600">Admin</p>
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">Model &amp; prompt configuration</h1>
        <p className="mt-2.5 max-w-xl text-[15px] leading-7 text-ink-muted">
          Applies to every clinician on this deployment. Saving bumps the prompt version, which is recorded on each
          piece of feedback so you can tell which prompt produced what.
        </p>
      </header>

      <form onSubmit={handleSave} className="space-y-7">
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold tracking-[-0.02em]">Model</h2>

          <label className="label" htmlFor="model">
            Model used for analysis and follow-ups
          </label>
          <select
            id="model"
            className="field"
            value={draft.model}
            onChange={(event) => setDraft({ ...draft, model: event.target.value })}
          >
            <optgroup label="Recommended">
              {data.models
                .filter((model) => model.recommended)
                .map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Other">
              {data.models
                .filter((model) => !model.recommended)
                .map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
            </optgroup>
          </select>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            {data.models.find((model) => model.id === draft.model)?.note}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="temperature">
                Temperature
              </label>
              <input
                id="temperature"
                type="number"
                min={0}
                max={1}
                step={0.1}
                className="field"
                value={draft.temperature}
                onChange={(event) => setDraft({ ...draft, temperature: Number(event.target.value) })}
              />
              <p className="mt-1.5 text-xs text-ink-faint">
                Only sent to models that accept sampling. Claude 4.6 and newer reject it, so it is omitted for
                those and this value has no effect.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="maxTokens">
                Max output tokens
              </label>
              <input
                id="maxTokens"
                type="number"
                min={1000}
                max={64000}
                step={1000}
                className="field"
                value={draft.maxTokens}
                onChange={(event) => setDraft({ ...draft, maxTokens: Number(event.target.value) })}
              />
              <p className="mt-1.5 text-xs text-ink-faint">Feedback is long-form; don&apos;t set this too low.</p>
            </div>
          </div>
        </section>

        <section className="card p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em]">Analysis prompt</h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                Instructions for the first pass over a transcript.
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost shrink-0 px-3 text-[13px]"
              onClick={() => setDraft({ ...draft, analysisPrompt: data.shippedDefaults.analysisPrompt })}
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>

          <label className="sr-only" htmlFor="analysisPrompt">
            Analysis prompt
          </label>
          <textarea
            id="analysisPrompt"
            rows={16}
            className="field font-mono text-[13px] leading-6"
            value={draft.analysisPrompt}
            onChange={(event) => setDraft({ ...draft, analysisPrompt: event.target.value })}
          />
        </section>

        <section className="card p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em]">Follow-up prompt</h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                Instructions for answering a clinician&apos;s question about a reviewed session.
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost shrink-0 px-3 text-[13px]"
              onClick={() => setDraft({ ...draft, followUpPrompt: data.shippedDefaults.followUpPrompt })}
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>

          <label className="sr-only" htmlFor="followUpPrompt">
            Follow-up prompt
          </label>
          <textarea
            id="followUpPrompt"
            rows={10}
            className="field font-mono text-[13px] leading-6"
            value={draft.followUpPrompt}
            onChange={(event) => setDraft({ ...draft, followUpPrompt: event.target.value })}
          />
        </section>

        {status && (
          <p
            role="alert"
            className={`flex gap-2.5 rounded-xl px-4 py-3.5 text-sm leading-6 ${
              status.kind === 'ok' ? 'bg-sage-50 text-sage-700' : 'bg-clay-50 text-clay-700'
            }`}
          >
            {status.kind === 'ok' && <CheckCircle2 size={17} className="mt-0.5 shrink-0" aria-hidden />}
            {status.message}
          </p>
        )}

        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-surface/95 px-5 py-4 backdrop-blur">
          <p className="text-xs leading-5 text-ink-faint">
            Version {data.config.version}
            {data.config.updatedBy ? ` · last saved by ${data.config.updatedBy}` : ''}
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => setDraft(toDraft(data))} disabled={!dirty || saving}>
              Discard changes
            </button>
            <button type="submit" className="btn-primary min-w-[140px]" disabled={!dirty || saving}>
              {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
              Save
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
