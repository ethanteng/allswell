'use client';

import { useState } from 'react';
import { ArrowUp, LoaderCircle, MessageSquareText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useWorkspace } from '@/store/workspace';
import type { Turn } from '@/lib/types';

const SUGGESTED_QUESTIONS = [
  'Where did I miss an opportunity to stay with the feeling?',
  'How did I handle the rupture, and what would have been better?',
  'Was the pacing right in the second half?',
];

export function FollowUpThread({ turns }: { turns: Turn[] }) {
  const { askFollowUp, working } = useWorkspace();
  const [question, setQuestion] = useState('');

  const followUps = turns.filter((turn) => turn.kind === 'FOLLOW_UP');

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || working) return;

    setQuestion('');
    await askFollowUp(trimmed);
  }

  return (
    <section className="space-y-5">
      <h3 className="flex items-center gap-2 text-base font-semibold tracking-[-0.02em] text-ink">
        <MessageSquareText size={17} className="text-sage-600" aria-hidden />
        Follow-up
      </h3>

      {followUps.map((turn) => (
        <article key={turn.id} className="space-y-3">
          <p className="rounded-2xl rounded-br-md bg-ink px-4 py-3 text-sm leading-6 text-white sm:ml-12">
            {turn.question}
          </p>
          <div className="prose prose-sm max-w-none rounded-2xl rounded-bl-md bg-sage-50 px-4 py-3.5 text-ink-muted prose-headings:text-ink prose-strong:text-ink prose-blockquote:border-l-sage-200 prose-blockquote:not-italic prose-blockquote:text-ink-muted sm:mr-12">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.answer ?? ''}</ReactMarkdown>
          </div>
        </article>
      ))}

      {followUps.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void submit(suggestion)}
              disabled={working}
              className="rounded-full border border-ink/12 px-3.5 py-2 text-left text-[13px] text-ink-muted transition hover:border-sage-500 hover:text-ink disabled:opacity-55"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(question);
        }}
        className="flex items-end gap-2 rounded-2xl border border-ink/12 bg-surface p-2.5"
      >
        <label htmlFor="follow-up" className="sr-only">
          Ask a follow-up about this session
        </label>
        <textarea
          id="follow-up"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter breaks the line — the convention for a
            // composer people will mostly use for one-line questions.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit(question);
            }
          }}
          rows={1}
          disabled={working}
          placeholder="Ask about this session…"
          className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-ink outline-none placeholder:text-ink-faint"
        />
        <button
          type="submit"
          disabled={working || !question.trim()}
          aria-label="Send follow-up question"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-white transition hover:bg-sage-700 disabled:opacity-45"
        >
          {working ? <LoaderCircle className="animate-spin" size={16} /> : <ArrowUp size={17} />}
        </button>
      </form>
    </section>
  );
}
