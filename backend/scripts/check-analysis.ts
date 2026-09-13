/**
 * Checks for the analysis logic that carries the most risk and no UI.
 *
 * Citation verification and the model-generation guards are pure functions
 * whose failure modes are silent: feedback quietly discarded, a fabricated
 * quote quietly shown, or a request rejected because a parameter went to a
 * model that doesn't take it. Run with `npm test`.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { EMPTY_AUDIT, unverifiedProseTimestamps, verifyCitations, type CitationAudit } from '../src/analysis/citations';
import type { FeedbackMoment } from '../src/analysis/feedback.types';
import { acceptsTemperature, supportsAdaptiveThinking } from '../src/analysis/claude-client';
import { computeStats } from '../src/analysis/heuristic-analyzer';
import { isRename, resolveOrder } from '../src/sessions/session-rules';

let failures = 0;
function check(label: string, passed: boolean): void {
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}`);
}

const transcript = readFileSync(
  join(__dirname, '../../frontend/public/samples/session-01-thanksgiving-boundaries.md'),
  'utf8',
);

const untimed = [
  'Therapist: Hi Daniel, good to see you. Where would you like to begin today?',
  "Client: I still haven't answered my parents about Thanksgiving.",
  "Therapist: What are some of the versions you've written?",
  'Therapist: So one version avoids the issue, and the other tries to secure every boundary before you arrive.',
].join('\n');

/** Runs one citation through the verifier and reports whether it survived. */
function kept(moment: FeedbackMoment, source = transcript): boolean {
  const audit: CitationAudit = { ...EMPTY_AUDIT };
  return verifyCitations([{ title: 'T', detail: 'd', moments: [moment] }], source, audit).length > 0;
}

console.log('# citations kept');
check('exact timestamp, verbatim quote', kept({ timestamp: '0:14', speaker: 'Therapist', quote: 'You’re right. I’m keeping my camera off today.' }));
check('zero-padded timestamp', kept({ timestamp: '00:14', speaker: 'Therapist', quote: 'You’re right.' }));
check('untimed transcript, real quote', kept({ timestamp: null, speaker: 'Therapist', quote: 'What are some of the versions you’ve written?' }, untimed));
check('wrong timestamp, real quote', kept({ timestamp: '55:55', speaker: 'Therapist', quote: 'What are some of the versions you’ve written?' }));

console.log('\n# citations dropped');
check('fabricated quote and timestamp', !kept({ timestamp: '99:99', speaker: 'Therapist', quote: 'You are clearly overreacting to all of this.' }));
check('fabricated quote, no timestamp', !kept({ timestamp: null, speaker: 'Therapist', quote: 'I think you should simply leave your family behind.' }));
check('quote too generic to identify a line', !kept({ timestamp: null, speaker: 'Therapist', quote: 'Okay.' }));
check('plausible clinical invention', !kept({ timestamp: null, speaker: 'Therapist', quote: 'Let us try a grounding exercise before we continue today.' }));

console.log('\n# quotes come from the transcript, not the model');
const audit: CitationAudit = { ...EMPTY_AUDIT };
const corrected = verifyCitations(
  [{ title: 'T', detail: 'd', moments: [{ timestamp: '4:54', speaker: 'Therapist', quote: 'a paraphrase the model invented' }] }],
  transcript,
  audit,
);
check('paraphrase replaced with the real line', audit.corrected === 1 && !corrected[0].moments[0].quote.includes('paraphrase'));
check('speaker corrected from the transcript', corrected[0].moments[0].speaker === 'Client');

console.log('\n# follow-up prose citations');
check('all-real timestamps flag nothing', unverifiedProseTimestamps('handled at [0:14] and repaired at [34:52]', transcript).length === 0);
const flagged = unverifiedProseTimestamps('at [2:25], then [55:12] and [61:03]', transcript);
check('fabricated timestamps flagged', flagged.length === 2 && flagged.includes('[55:12]'));
check('real timestamp not flagged', !flagged.includes('[2:25]'));
check('untimed transcript flags nothing', unverifiedProseTimestamps('cited [12:34]', untimed).length === 0);

console.log('\n# model generation guards');
for (const [model, thinking] of [['claude-sonnet-5', true], ['claude-opus-5', true], ['claude-opus-4-8', true], ['claude-haiku-4-5', false]] as const) {
  check(`${model}: adaptive thinking / effort = ${thinking}`, supportsAdaptiveThinking(model) === thinking);
  check(`${model}: temperature sent = ${!thinking}`, acceptsTemperature(model) === !thinking);
}

console.log('\n# stats are computed from the transcript');
const stats = computeStats(transcript);
check('turn counts and talk share derived', stats.therapistTurns === 158 && stats.clientTurns === 157 && stats.therapistTalkSharePct === 52);

console.log('\n# only a real rename takes the title from the analyzer');
check('a changed title is a rename', isRename('Session 3', 'Daniel R. — custody'));
check('the same title resubmitted is not', !isRename('Session 3', 'Session 3'));
check('whitespace around an unchanged title is not', !isRename('Session 3', '  Session 3  '));
check('a date-only edit sends no title at all', !isRename('Session 3', undefined));
check('an empty title is still a change', isRename('Session 3', ''));

console.log('\n# session ordering');
const rows = ['a', 'b', 'c', 'd'];
check('full list applied as given', resolveOrder(rows, ['d', 'a', 'c', 'b']).join('') === 'dacb');
check('unnamed sessions follow, in their existing order', resolveOrder(rows, ['c', 'a']).join('') === 'cabd');
check('duplicates collapse to the first occurrence', resolveOrder(rows, ['b', 'b', 'a']).join('') === 'bacd');
check('ids that are not this client\'s are ignored', resolveOrder(rows, ['zz', 'c']).join('') === 'cabd');
check('an empty request changes nothing', resolveOrder(rows, []).join('') === 'abcd');
check('every session is still present exactly once', resolveOrder(rows, ['d', 'd', 'b']).slice().sort().join('') === 'abcd');

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
