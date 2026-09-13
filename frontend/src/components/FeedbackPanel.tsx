'use client';

import { CircleAlert, Lightbulb, Quote, ThumbsUp } from 'lucide-react';
import type { FeedbackItem, SessionFeedback } from '@/lib/types';

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-sage-50 px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">{label}</div>
      <div className="mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">{value}</div>
    </div>
  );
}

/**
 * One feedback point plus the transcript moments that evidence it.
 *
 * The moments are the whole point of the component: a supervisory note without
 * a citation is an opinion, and clicking one takes you to the line it came from.
 */
function FeedbackCard({
  item,
  tone,
  onCite,
}: {
  item: FeedbackItem;
  tone: 'strength' | 'growth';
  onCite: (timestamp: string) => void;
}) {
  const isStrength = tone === 'strength';

  return (
    <article
      className={`rounded-2xl border p-5 ${
        isStrength ? 'border-sage-200/70 bg-sage-50/50' : 'border-clay-100 bg-clay-50/50'
      }`}
    >
      <h4 className="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-ink">{item.title}</h4>
      <p className="mt-2 text-sm leading-6 text-ink-muted">{item.detail}</p>

      {item.suggestion && (
        <p className="mt-3 flex gap-2.5 rounded-xl bg-surface/80 p-3.5 text-sm leading-6 text-ink">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-clay-500" aria-hidden />
          <span>{item.suggestion}</span>
        </p>
      )}

      {item.moments.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">
            <Quote size={11} aria-hidden />
            From the session
          </div>
          <ul className="space-y-1.5">
            {item.moments.map((moment, index) => (
              <li key={`${moment.timestamp ?? 'untimed'}-${index}`}>
                <button
                  type="button"
                  onClick={() => moment.timestamp && onCite(moment.timestamp)}
                  disabled={!moment.timestamp}
                  className="group flex w-full gap-3 rounded-xl bg-surface/90 p-3 text-left transition hover:bg-surface disabled:cursor-default"
                >
                  <span className="shrink-0 pt-0.5 font-mono text-[11px] font-semibold text-sage-600 group-hover:underline">
                    {moment.timestamp ?? '—'}
                  </span>
                  <span className="text-[13px] leading-[21px] text-ink-muted">
                    <span className="font-semibold text-ink">{moment.speaker}: </span>
                    {moment.quote}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export function FeedbackPanel({
  feedback,
  onCite,
}: {
  feedback: SessionFeedback;
  onCite: (timestamp: string) => void;
}) {
  const { stats } = feedback;

  return (
    <div className="space-y-8">
      {feedback.generatedBy === 'heuristic-stub' && (
        <p className="flex gap-2.5 rounded-xl border border-clay-100 bg-clay-50 p-4 text-sm leading-6 text-clay-700">
          <CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">Placeholder output.</strong> This deployment has no Anthropic API
            key configured, so this feedback comes from pattern matching over the transcript rather than from a
            model. The citations are real lines from the session; the clinical reasoning behind them is not.
          </span>
        </p>
      )}

      <header>
        <h2 className="text-xl font-semibold leading-8 tracking-[-0.025em] text-ink">{feedback.headline}</h2>
        <p className="mt-2.5 text-[15px] leading-7 text-ink-muted">{feedback.summary}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Length" value={stats.durationLabel ?? '—'} />
        <StatTile label="Clinician turns" value={String(stats.therapistTurns)} />
        <StatTile label="Questions asked" value={String(stats.therapistQuestions)} />
        <StatTile
          label="Clinician talk share"
          value={stats.therapistTalkSharePct !== null ? `${stats.therapistTalkSharePct}%` : '—'}
        />
      </div>

      {feedback.themes.length > 0 && (
        <section>
          <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">Themes present</h3>
          <ul className="flex flex-wrap gap-2">
            {feedback.themes.map((theme) => (
              <li key={theme} className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-medium text-ink-muted">
                {theme}
              </li>
            ))}
          </ul>
        </section>
      )}

      {feedback.strengths.length > 0 && (
        <section>
          <h3 className="mb-3.5 flex items-center gap-2 text-base font-semibold tracking-[-0.02em] text-ink">
            <ThumbsUp size={17} className="text-sage-600" aria-hidden />
            What worked
          </h3>
          <div className="space-y-3">
            {feedback.strengths.map((item) => (
              <FeedbackCard key={item.title} item={item} tone="strength" onCite={onCite} />
            ))}
          </div>
        </section>
      )}

      {feedback.growthAreas.length > 0 && (
        <section>
          <h3 className="mb-3.5 flex items-center gap-2 text-base font-semibold tracking-[-0.02em] text-ink">
            <Lightbulb size={17} className="text-clay-500" aria-hidden />
            What to try differently
          </h3>
          <div className="space-y-3">
            {feedback.growthAreas.map((item) => (
              <FeedbackCard key={item.title} item={item} tone="growth" onCite={onCite} />
            ))}
          </div>
        </section>
      )}

      {feedback.strengths.length === 0 && feedback.growthAreas.length === 0 && (
        <p className="rounded-2xl bg-sage-50 p-5 text-sm leading-6 text-ink-muted">
          No feedback points were produced for this transcript. If the transcript uses an unusual speaker format, the
          parser may not have recognized the clinician&apos;s turns.
        </p>
      )}
    </div>
  );
}
