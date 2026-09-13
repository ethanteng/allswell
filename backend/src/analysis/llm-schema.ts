import { z } from 'zod';

/**
 * What the model is asked to produce.
 *
 * `title` is session metadata rather than feedback, so it is written onto the
 * session itself instead of into `SessionFeedback` — and only while the
 * clinician has not named the session themselves.
 *
 * Otherwise deliberately narrower than `SessionFeedback`: the stats block (turn counts,
 * question counts, talk share, duration) is computed from the transcript and
 * merged in afterwards. Asking a model to count turns invites confident wrong
 * numbers for something a parser gets exactly right, and a wrong number next to
 * real clinical observations undermines the observations too.
 *
 * Every field is required. Structured outputs constrain the response to this
 * shape on the wire, so optional keys would only add branches to handle.
 */

const MomentSchema = z.object({
  timestamp: z
    .string()
    .describe('The bracketed timestamp of the cited line, exactly as it appears, e.g. "12:34".'),
  speaker: z.string().describe('The speaker label of the cited line, e.g. "Therapist".'),
  quote: z.string().describe('The cited line, quoted verbatim from the transcript.'),
});

const StrengthSchema = z.object({
  title: z.string().describe('Short phrase naming what the clinician did well.'),
  detail: z
    .string()
    .describe('Why it worked, in mechanism terms — what the move accomplished, not a compliment.'),
  moments: z
    .array(MomentSchema)
    .describe('Lines from the transcript that evidence this point. At least one.'),
});

const GrowthSchema = z.object({
  title: z.string().describe('Short phrase naming what could be done differently.'),
  detail: z.string().describe('What happened and why it limited the work.'),
  suggestion: z
    .string()
    .describe('What to try instead, concrete enough to use in the next session.'),
  moments: z
    .array(MomentSchema)
    .describe('Lines from the transcript that evidence this point. At least one.'),
});

export const LlmFeedbackSchema = z.object({
  title: z
    .string()
    .describe(
      'Short label naming what this session was about, for a clinician scanning a list of ' +
        'sessions — e.g. "Boundary-setting with parents". A few words, not a sentence, and ' +
        'not a line lifted from the transcript.',
    ),
  headline: z.string().describe('One line characterizing the session.'),
  summary: z
    .string()
    .describe('Short paragraph a supervisor would open with, addressed to the clinician.'),
  strengths: z.array(StrengthSchema),
  growthAreas: z.array(GrowthSchema),
  themes: z
    .array(z.string())
    .describe('Clinical themes present, for orientation rather than judgment.'),
});

export type LlmFeedback = z.infer<typeof LlmFeedbackSchema>;
