import type { FeedbackItem, FeedbackMoment } from './feedback.types';
import { excerpt, parseTranscript, type Utterance } from './transcript';

/**
 * Checks every cited moment against the transcript it came from.
 *
 * The whole design rests on feedback being anchored to real moments, so a
 * fabricated or misattributed quote is worse here than a missing one: it is the
 * part a clinician would trust most and check least. A model asked to quote
 * verbatim mostly does, but "mostly" is not a property to build a clinical tool
 * on, and paraphrase drifts silently.
 *
 * So a citation is only kept when its timestamp names a line that actually
 * exists, and the text shown is then taken from the transcript rather than from
 * the model — which makes quotes verbatim by construction instead of by trust.
 */

export interface CitationAudit {
  /** Moments the model produced. */
  total: number;
  /** Moments whose timestamp matched a real line. */
  verified: number;
  /** Moments dropped because no line carried that timestamp. */
  unmatched: number;
  /** Moments kept, but whose quoted text did not match the line's real text. */
  corrected: number;
  /** Feedback points dropped for ending up with no verified moment. */
  droppedItems: number;
}

export const EMPTY_AUDIT: CitationAudit = {
  total: 0,
  verified: 0,
  unmatched: 0,
  corrected: 0,
  droppedItems: 0,
};

/** "0:14", "00:14" and "0:00:14" are the same moment; index on seconds. */
function timestampKey(timestamp: string | null): number | null {
  if (!timestamp) return null;

  const parts = timestamp.trim().split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some(Number.isNaN)) return null;

  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
}

/** Strips the differences that don't change what was said. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[…]/g, '')
    .replace(/[^a-z0-9'" ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when the model's quote plausibly refers to the line it cited.
 *
 * Compares a prefix rather than the whole string: models routinely quote the
 * first sentence of a long turn, or trail off with an ellipsis, and neither is
 * a misattribution.
 */
function quoteMatchesLine(quote: string, line: string): boolean {
  const quoted = normalise(quote);
  const actual = normalise(line);
  if (!quoted) return false;
  if (actual.includes(quoted) || quoted.includes(actual)) return true;

  const prefix = quoted.slice(0, 60);
  return prefix.length >= 20 && actual.includes(prefix);
}

function indexByTimestamp(utterances: Utterance[]): Map<number, Utterance> {
  const index = new Map<number, Utterance>();

  for (const utterance of utterances) {
    const key = timestampKey(utterance.timestamp);
    // First line wins on a duplicated timestamp; later ones are continuations.
    if (key !== null && !index.has(key)) index.set(key, utterance);
  }

  return index;
}

/**
 * Returns the feedback with unverifiable citations removed, and a count of what
 * was changed. Points left with no evidence are dropped: an uncited claim is
 * exactly what the prompt tells the model not to produce.
 */
export function verifyCitations<T extends FeedbackItem>(
  items: T[],
  transcript: string,
  audit: CitationAudit,
): T[] {
  const index = indexByTimestamp(parseTranscript(transcript));
  const kept: T[] = [];

  for (const item of items) {
    const moments: FeedbackMoment[] = [];

    for (const moment of item.moments) {
      audit.total += 1;

      const line = index.get(timestampKey(moment.timestamp) ?? Number.NaN);
      if (!line) {
        audit.unmatched += 1;
        continue;
      }

      audit.verified += 1;
      if (!quoteMatchesLine(moment.quote, line.text)) audit.corrected += 1;

      // Take the text and speaker from the transcript, not the model.
      moments.push({
        timestamp: line.timestamp,
        speaker: line.speaker,
        quote: excerpt(line.text),
      });
    }

    if (moments.length === 0) {
      audit.droppedItems += 1;
      continue;
    }

    kept.push({ ...item, moments });
  }

  return kept;
}
