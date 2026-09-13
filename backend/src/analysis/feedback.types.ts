/**
 * Shape of the structured feedback stored on an ANALYSIS turn.
 *
 * Kept in one place because it is the contract between three things: the
 * analyser that produces it, the `Turn.feedback` JSON column, and the frontend
 * response pane. When the real model call replaces the stub, it should be
 * constrained to emit exactly this.
 */

/** A cited moment in the transcript. `timestamp` is the raw "12:34" label. */
export interface FeedbackMoment {
  timestamp: string | null;
  speaker: string;
  quote: string;
}

export interface FeedbackItem {
  title: string;
  detail: string;
  /** Specific lines that evidence the point. May be empty for general notes. */
  moments: FeedbackMoment[];
  /** Present on growth areas: what to try instead. */
  suggestion?: string;
}

export interface FeedbackStats {
  durationLabel: string | null;
  therapistTurns: number;
  clientTurns: number;
  therapistQuestions: number;
  /** Share of spoken words that were the therapist's, 0-100. */
  therapistTalkSharePct: number | null;
}

export interface SessionFeedback {
  /** One-line characterisation of the session. */
  headline: string;
  /** Short paragraph a supervisor would open with. */
  summary: string;
  stats: FeedbackStats;
  strengths: FeedbackItem[];
  growthAreas: FeedbackItem[];
  /** Clinical themes present, for orientation rather than judgement. */
  themes: string[];
  /** Distinguishes stub output from real model output in the UI. */
  generatedBy: 'heuristic-stub' | 'llm';
}
