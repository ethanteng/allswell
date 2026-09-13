/** Parsing helpers shared by the analyzer and the session title generator. */

export interface Utterance {
  /** Raw label such as "12:34", or null when the line carried no timestamp. */
  timestamp: string | null;
  /** Seconds, derived from `timestamp`. Null when absent or unparseable. */
  seconds: number | null;
  speaker: string;
  text: string;
}

/** `[12:34] Therapist: ...` — the shape the provided sample transcripts use. */
const SPEAKER_LINE = /^\s*(?:\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*)?([A-Za-z][A-Za-z .'-]{0,40}?)\s*:\s*(.*)$/;

function toSeconds(timestamp: string | null): number | null {
  if (!timestamp) return null;
  const parts = timestamp.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  // "1:02:03" is h:m:s; "12:34" is m:s.
  return parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts[0] * 60 + parts[1];
}

/**
 * Splits a transcript into utterances.
 *
 * Lines that don't open a new speaker turn are appended to the previous one, so
 * a wrapped paragraph stays a single utterance rather than being dropped.
 */
export function parseTranscript(transcript: string): Utterance[] {
  const utterances: Utterance[] = [];

  for (const line of transcript.split(/\r?\n/)) {
    if (!line.trim()) continue;

    const match = SPEAKER_LINE.exec(line);
    if (match) {
      const [, timestamp = null, speaker, text] = match;
      utterances.push({
        timestamp: timestamp ?? null,
        seconds: toSeconds(timestamp ?? null),
        speaker: speaker.trim(),
        text: text.trim(),
      });
      continue;
    }

    const previous = utterances[utterances.length - 1];
    if (previous) previous.text = `${previous.text} ${line.trim()}`.trim();
  }

  return utterances;
}

/** True for the clinician's side of the conversation. */
export function isTherapist(utterance: Utterance): boolean {
  const speaker = utterance.speaker.toLowerCase();
  return speaker.startsWith('therapist') || speaker.startsWith('clinician') || speaker.startsWith('counselor');
}

export function isClient(utterance: Utterance): boolean {
  const speaker = utterance.speaker.toLowerCase();
  return speaker.startsWith('client') || speaker.startsWith('patient');
}

/** Trims a quote to something a feedback card can show without wrapping badly. */
export function excerpt(text: string, maxLength = 180): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLength) return collapsed;
  const cut = collapsed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : maxLength).trimEnd()}…`;
}
