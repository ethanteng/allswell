import type { FeedbackItem, FeedbackMoment, SessionFeedback } from './feedback.types';
import { excerpt, isClient, isTherapist, parseTranscript, type Utterance } from './transcript';

/**
 * Placeholder analyser that stands in for the model call.
 *
 * It is deliberately *not* canned text: it parses the transcript and cites real
 * lines, so the response UI is exercised with genuine data and the citation
 * affordances can be judged before any prompt work happens. The clinical
 * reasoning is shallow by construction — keyword detectors, not judgement —
 * which is why every payload is stamped `generatedBy: 'heuristic-stub'` and the
 * UI labels it as a placeholder.
 */

interface Detector {
  title: string;
  detail: string;
  suggestion?: string;
  /** Cues matched against the therapist's lines. */
  patterns: RegExp[];
  /** Emit only when at least this many lines match. */
  minMatches?: number;
}

const STRENGTH_DETECTORS: Detector[] = [
  {
    title: 'Named the process change and offered real choices',
    detail:
      'Rather than pressing on, the clinician surfaced a change in the frame and put concrete alternatives on the table, leaving the decision with the client.',
    patterns: [/\bwe can (pause|continue|switch|revisit|reschedule)\b/i, /\bhow is that landing\b/i, /\bwould you (like|prefer)\b/i, /\bwe can decide\b/i],
  },
  {
    title: 'Checked the therapeutic frame before working',
    detail:
      'Privacy, location, and readiness were confirmed early, which keeps remote work defensible and signals that the clinician is tracking conditions, not just content.',
    patterns: [/\bsomewhere you can speak privately\b/i, /\bare you at home\b/i, /\bprivate space\b/i, /\bwho else is (there|home)\b/i],
  },
  {
    title: 'Asked open questions and let the client fill the space',
    detail:
      'The session is carried by short, open prompts rather than long clinician turns, which keeps the client doing the cognitive work.',
    patterns: [/^what\b/i, /^how\b/i, /\bwhat (do|does|are|would|might|led|evidence|feelings|happened)\b/i, /\bhow (would|might|do|does|did)\b/i],
    minMatches: 6,
  },
  {
    title: 'Reflected and consolidated before moving on',
    detail:
      'Summarising the client’s position back to them — including the bind they are in — checks understanding and slows an anxious pace.',
    patterns: [/\bso one version\b/i, /\bit sounds like\b/i, /\bwhat i hear\b/i, /\blet me (summari[sz]e|make sure)\b/i, /\bso (the|there is|there’s)\b/i, /\bthank you\.? it sounds\b/i],
  },
  {
    title: 'Used scaling to make change observable',
    detail:
      'Numeric ratings turn a vague sense of dread into something that can be re-measured later in the session and across sessions.',
    patterns: [/\bzero to one hundred\b/i, /\bhow (confident|believable|much do you believe)\b/i, /\bfrom zero to\b/i, /\bwhere (is|are) (that|the) (belief|anxiety)\b/i],
  },
  {
    title: 'Named the model out loud and worked it explicitly',
    detail:
      'Making the framework visible — situation, thought, emotion, action — teaches the client a portable method rather than delivering conclusions.',
    patterns: [/\bcbt\b/i, /\bautomatic thought\b/i, /\bbalanced thought\b/i, /\bevidence (supports|points|against)\b/i, /\bwhat is the (automatic )?thought\b/i],
  },
  {
    title: 'Rehearsed the hard moment in the room',
    detail:
      'Role-play moves a plan from intention to something the client has actually said out loud, which is what makes the words available under stress.',
    patterns: [/\bi’ll (be|play) (your|the)\b/i, /\bi’ll push\b/i, /\bkeep going as if\b/i, /\bwould you like to rehearse\b/i, /\blet’s practi[cs]e\b/i],
  },
  {
    title: 'Checked safety concretely rather than assuming',
    detail:
      'Risk was assessed against specifics — who is present, access to transport and a phone, whether anyone could prevent leaving — instead of a generic sweep.',
    patterns: [/\bphysical safety\b/i, /\bprevent you from leaving\b/i, /\bemergency\b/i, /\bcrisis resources\b/i, /\baccess to (money|a phone)\b/i, /\bthreats?\b/i],
  },
  {
    title: 'Converted insight into a testable between-session step',
    detail:
      'A specific behavioural experiment with a predicted outcome and a measure gives the next session real data instead of impressions.',
    patterns: [/\bbehavio(u)?ral experiment\b/i, /\bbetween sessions\b/i, /\bwhat is your prediction\b/i, /\bhow could you measure\b/i, /\bwould you be willing to try\b/i],
  },
  {
    title: 'Protected the ending with a summary and a check',
    detail:
      'Time was named, next steps were narrowed to something manageable, and the clinician asked how the client felt about stopping.',
    patterns: [/\bwe have about (five|ten|\d+) minutes\b/i, /\bi’d like to summari[sz]e\b/i, /\bhow are you feeling about ending\b/i, /\bmost important next steps\b/i],
  },
  {
    title: 'Repaired the rupture explicitly and committed to a change',
    detail:
      'The clinician took responsibility for the disruption, validated the client’s reaction rather than defending, and named what will be different next time.',
    patterns: [/\bi’m sorry\b/i, /\bi’ll (make a note|be on camera)\b/i, /\byour (need|annoyance) (for|makes)\b/i, /\bi appreciate you (saying|telling)\b/i, /\bfeedback about what helps\b/i],
  },
  {
    title: 'Made space for affect instead of staying in planning',
    detail:
      'When grief surfaced, the clinician slowed down, offered a choice about how to use the moment, and named the feeling rather than solving it.',
    patterns: [/\bwe can slow down\b/i, /\bquiet moment\b/i, /\bwhat do you need in this moment\b/i, /\bthere may be grief\b/i, /\btake your time\b/i],
  },
];

const GROWTH_DETECTORS: Detector[] = [
  {
    title: 'Several questions arrived stacked in one turn',
    detail:
      'When two or three questions land together the client generally answers the last one, and the others are quietly lost.',
    suggestion: 'Ask one question, then wait. If the second still matters after the answer, it will still be there.',
    patterns: [/\?[^?]{0,120}\?/],
    minMatches: 3,
  },
  {
    title: 'Suggestions were offered before the client’s own ideas were exhausted',
    detail:
      'Clinician-generated options arrive quickly in places where the client was still generating their own, which subtly relocates authorship of the plan.',
    suggestion: 'Try "what else have you considered?" once more before adding your own option, and mark yours as one item on their list rather than the answer.',
    patterns: [
      /\bi’d also consider\b/i,
      /\byou could (try|consider|ask|also|say something like|put)\b/i,
      /\byou might (also|want to|consider)\b/i,
      /\bi’d suggest\b/i,
      /\bwhat i would\b/i,
    ],
    minMatches: 2,
  },
  {
    title: 'Psychoeducation ran ahead of the client’s stated experience',
    detail:
      'Some explanatory turns are longer than the client’s replies around them. Explanation lands better once the client has named the thing in their own words.',
    suggestion: 'Where a turn runs past three sentences, consider cutting it to the first one and asking what the client makes of it.',
    patterns: [
      /\bthe (goal|point) (isn’t|is not)\b/i,
      /\bagency is often\b/i,
      /\banxiety (compresses|narrows)\b/i,
      /\ba boundary is not\b/i,
      /\brehearsal (isn’t|is not) the same\b/i,
    ],
    minMatches: 2,
  },
  {
    title: 'Emotion was acknowledged and then moved past quickly',
    detail:
      'In places an affect word from the client is followed by a return to planning within the same turn, before the feeling has been given its own space.',
    suggestion: 'When a feeling is named, try staying with it for one full exchange before the next planning question.',
    patterns: [
      /\bthat (makes sense|sounds painful|sounds important)\b[^?]{0,90}\b(what|how|let’s)\b[^?]{0,90}\?/i,
      /\bof course\b[^?]{0,90}\bwhat\b[^?]{0,90}\?/i,
      /\bthere may be grief here\b/i,
    ],
    minMatches: 2,
  },
  {
    title: 'A significant thread was named late and deferred',
    detail:
      'Material the client themselves called "the bigger thing underneath" surfaced close to the end, leaving no room to work it.',
    suggestion: 'When a deeper theme appears mid-session, consider flagging it and negotiating the agenda then, rather than carrying the full plan to time.',
    patterns: [/\bwe (touched|did not fully explore)\b/i, /\breturn to that next session\b/i, /\bdeserves more room\b/i, /\bthe bigger thing\b/i],
  },
  {
    title: 'The process disruption was addressed on the client’s initiative',
    detail:
      'The change in frame was raised early, but its emotional cost only became explicit once the client volunteered it at a vulnerable moment.',
    suggestion: 'Consider a brief mid-session check when you have altered the frame, rather than waiting for the client to carry the cost of raising it twice.',
    patterns: [/\bi’m trying not to cry because you can’t see me\b/i, /\bi wished i could see your face\b/i, /\bstill less than usual\b/i, /\bi was worried saying something\b/i],
  },
];

function matchesFor(detector: Detector, therapistLines: Utterance[]): FeedbackMoment[] {
  const moments: FeedbackMoment[] = [];

  for (const line of therapistLines) {
    if (detector.patterns.some((pattern) => pattern.test(line.text))) {
      moments.push({ timestamp: line.timestamp, speaker: line.speaker, quote: excerpt(line.text) });
    }
  }

  return moments;
}

/** Keeps cards readable: the earliest few hits usually tell the story. */
function topMoments(moments: FeedbackMoment[], limit = 3): FeedbackMoment[] {
  return moments.slice(0, limit);
}

function runDetectors(detectors: Detector[], therapistLines: Utterance[], limit: number): FeedbackItem[] {
  const items: FeedbackItem[] = [];

  for (const detector of detectors) {
    const moments = matchesFor(detector, therapistLines);
    if (moments.length < (detector.minMatches ?? 1)) continue;

    items.push({
      title: detector.title,
      detail: detector.detail,
      suggestion: detector.suggestion,
      moments: topMoments(moments),
    });
  }

  // More evidence is a rough proxy for how central the pattern was.
  return items.sort((a, b) => b.moments.length - a.moments.length).slice(0, limit);
}

const THEME_PATTERNS: Array<[string, RegExp]> = [
  ['Family of origin', /\b(family|parents?|mother|mom|father|dad|uncle|aunt|grandmother)\b/i],
  ['Boundary setting', /\bboundar(y|ies)\b/i],
  ['Anxiety', /\banxiety|anxious|panic\b/i],
  ['Grief and loss', /\bgrief|sad(ness)?|loss|died\b/i],
  ['LGBTQ+ identity and disclosure', /\b(trans|pronouns?|came out|queer|partner’s identity)\b/i],
  ['Couple and partner dynamics', /\b(partner|boyfriend|girlfriend|spouse|husband|wife)\b/i],
  ['Avoidance and safety behaviours', /\bavoid(ing|ance)?|freez(e|ing)|over-?prepare\b/i],
  ['Shame', /\bsham(e|eful)|embarrass(ed|ment)\b/i],
  ['Therapeutic alliance and rupture', /\b(camera|connected to me|reschedule|repair)\b/i],
];

function detectThemes(utterances: Utterance[]): string[] {
  const corpus = utterances.map((utterance) => utterance.text).join(' ');
  return THEME_PATTERNS.filter(([, pattern]) => pattern.test(corpus)).map(([label]) => label);
}

function durationLabel(utterances: Utterance[]): string | null {
  const timed = utterances.filter((utterance) => utterance.seconds !== null);
  if (timed.length === 0) return null;

  const lastSeconds = timed[timed.length - 1].seconds as number;
  const minutes = Math.round(lastSeconds / 60);
  return minutes > 0 ? `~${minutes} min` : '<1 min';
}

function wordCount(utterances: Utterance[]): number {
  return utterances.reduce((total, utterance) => total + utterance.text.split(/\s+/).filter(Boolean).length, 0);
}

/**
 * Produces structured feedback for a transcript. Pure and synchronous — no
 * network — so it is safe to call inline on the request path.
 */
export function analyseTranscript(transcript: string): SessionFeedback {
  const utterances = parseTranscript(transcript);
  const therapistLines = utterances.filter(isTherapist);
  const clientLines = utterances.filter(isClient);

  const therapistWords = wordCount(therapistLines);
  const clientWords = wordCount(clientLines);
  const totalWords = therapistWords + clientWords;
  const talkShare = totalWords > 0 ? Math.round((therapistWords / totalWords) * 100) : null;

  const therapistQuestions = therapistLines.filter((line) => line.text.includes('?')).length;

  const strengths = runDetectors(STRENGTH_DETECTORS, therapistLines, 5);
  const growthAreas = runDetectors(GROWTH_DETECTORS, therapistLines, 4);

  // A transcript with no recognisable clinician turns is almost always a paste
  // problem, and saying so beats returning four empty cards.
  const unparsed = therapistLines.length === 0;

  const headline = unparsed
    ? 'No clinician turns detected in this transcript'
    : talkShare !== null && talkShare > 55
      ? 'Structured session, carried largely by the clinician'
      : 'Structured session with the client doing most of the work';

  const summary = unparsed
    ? 'The transcript could not be split into speaker turns, so no session-level feedback was produced. Check that each line is prefixed with a speaker label such as "Therapist:" or "Client:".'
    : `${therapistLines.length} clinician turns and ${clientLines.length} client turns${
        talkShare !== null ? `, with the clinician accounting for roughly ${talkShare}% of what was said` : ''
      }. ${therapistQuestions} clinician turns contained a question. The notes below cite specific moments; they are pattern matches over the transcript, not clinical judgement.`;

  return {
    headline,
    summary,
    stats: {
      durationLabel: durationLabel(utterances),
      therapistTurns: therapistLines.length,
      clientTurns: clientLines.length,
      therapistQuestions,
      therapistTalkSharePct: talkShare,
    },
    strengths,
    growthAreas,
    themes: detectThemes(utterances),
    generatedBy: 'heuristic-stub',
  };
}
