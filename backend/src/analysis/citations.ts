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
 * Finds the line a quote came from by its text.
 *
 * Timestamps are the precise anchor, but not every transcript has them — a
 * paste of plain `Therapist:` / `Client:` turns parses perfectly well and is
 * accepted by the API. Matching on the quote keeps those transcripts working
 * instead of silently discarding every point, and it also rescues a citation
 * whose quote is right but whose timestamp is a line or two off.
 */
function findByQuote(quote: string, utterances: Utterance[]): Utterance | null {
  const quoted = normalise(quote);
  if (quoted.length < 12) return null; // too short to identify a line

  const prefix = quoted.slice(0, 80);

  for (const utterance of utterances) {
    const actual = normalise(utterance.text);
    if (!actual) continue;
    if (actual.includes(prefix) || (quoted.length >= 20 && quoted.includes(actual))) {
      return utterance;
    }
  }

  return null;
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
  const utterances = parseTranscript(transcript);
  const index = indexByTimestamp(utterances);
  const kept: T[] = [];

  for (const item of items) {
    const moments: FeedbackMoment[] = [];

    for (const moment of item.moments) {
      audit.total += 1;

      // Timestamp first — it is unambiguous. Quote text is the fallback, which
      // is what an untimed transcript relies on entirely.
      const line =
        index.get(timestampKey(moment.timestamp) ?? Number.NaN) ?? findByQuote(moment.quote, utterances);

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

/**
 * Checks the timestamps a follow-up answer cites in its prose.
 *
 * Follow-ups are markdown, not structured output, so they cannot go through
 * `verifyCitations` — but the follow-up prompt asks the model to cite
 * timestamps, which means the same fabrication risk reaches the clinician by a
 * different route. The analysis pane's guarantee would be worth much less if
 * the conversation beside it had no guarantee at all.
 *
 * This reports rather than rewrites: silently deleting a reference from
 * clinical prose can change what the surrounding sentence claims, which is a
 * worse failure than flagging it.
 */
export function unverifiedProseTimestamps(answer: string, transcript: string): string[] {
  const real = new Set<number>();
  for (const utterance of parseTranscript(transcript)) {
    const key = timestampKey(utterance.timestamp);
    if (key !== null) real.add(key);
  }

  // Nothing to check against: an untimed transcript can't have cited timestamps.
  if (real.size === 0) return [];

  const cited = answer.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g) ?? [];
  const unverified = new Set<string>();

  for (const token of cited) {
    const raw = token.slice(1, -1);
    const key = timestampKey(raw);
    if (key === null || !real.has(key)) unverified.add(token);
  }

  return [...unverified];
}
