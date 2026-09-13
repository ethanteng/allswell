'use client';

import { useEffect, useMemo, useRef } from 'react';

interface ParsedLine {
  key: string;
  timestamp: string | null;
  speaker: string | null;
  text: string;
}

const SPEAKER_LINE = /^\s*(?:\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*)?([A-Za-z][A-Za-z .'-]{0,40}?)\s*:\s*(.*)$/;

/** Mirrors the backend parser so citations line up with what is rendered. */
function parse(transcript: string): ParsedLine[] {
  const lines: ParsedLine[] = [];

  transcript.split(/\r?\n/).forEach((raw, index) => {
    if (!raw.trim()) return;

    const match = SPEAKER_LINE.exec(raw);
    if (match) {
      const [, timestamp = null, speaker, text] = match;
      lines.push({ key: `line-${index}`, timestamp: timestamp ?? null, speaker: speaker.trim(), text: text.trim() });
      return;
    }

    const previous = lines[lines.length - 1];
    if (previous) previous.text = `${previous.text} ${raw.trim()}`.trim();
    else lines.push({ key: `line-${index}`, timestamp: null, speaker: null, text: raw.trim() });
  });

  return lines;
}

function isClinician(speaker: string | null): boolean {
  if (!speaker) return false;
  const normalized = speaker.toLowerCase();
  return normalized.startsWith('therapist') || normalized.startsWith('clinician') || normalized.startsWith('counselor');
}

export function TranscriptView({ transcript, highlight }: { transcript: string; highlight: string | null }) {
  const lines = useMemo(() => parse(transcript), [transcript]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll the cited line into view whenever the citation target changes. Keyed
  // on `highlight` so clicking the same citation twice still re-scrolls.
  useEffect(() => {
    if (!highlight) return;

    const target = containerRef.current?.querySelector<HTMLElement>(`[data-timestamp="${CSS.escape(highlight)}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight]);

  return (
    <div ref={containerRef} className="space-y-3">
      <p className="text-sm leading-6 text-ink-muted">
        {lines.length} line{lines.length === 1 ? '' : 's'}. Clinician turns are marked; citations in the feedback link
        here.
      </p>

      <div className="divide-y divide-ink/[0.06] rounded-2xl border border-ink/10 bg-surface">
        {lines.map((line) => {
          const isTarget = highlight !== null && line.timestamp === highlight;

          return (
            <div
              key={line.key}
              data-timestamp={line.timestamp ?? undefined}
              className={`flex gap-4 px-4 py-3 transition-colors sm:px-5 ${isTarget ? 'bg-sage-100' : ''}`}
            >
              <span className="w-12 shrink-0 pt-0.5 font-mono text-[11px] text-ink-faint">{line.timestamp ?? ''}</span>
              <p className="text-[14px] leading-[23px] text-ink-muted">
                {line.speaker && (
                  <span className={`font-semibold ${isClinician(line.speaker) ? 'text-sage-700' : 'text-ink'}`}>
                    {line.speaker}:{' '}
                  </span>
                )}
                {line.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
