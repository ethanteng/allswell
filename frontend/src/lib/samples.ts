/**
 * Sample transcripts shipped with the app.
 *
 * Served as static files from /public rather than bundled, so a ~40KB
 * transcript is fetched only when someone actually asks for a sample.
 */
export interface SampleTranscript {
  id: string;
  label: string;
  description: string;
  path: string;
  suggestedClientName: string;
}

export const SAMPLE_TRANSCRIPTS: SampleTranscript[] = [
  {
    id: 'session-01',
    label: 'Boundary planning with family',
    description:
      'A 45-minute CBT session. Includes a frame rupture (clinician off camera unannounced) and its later repair.',
    path: '/samples/session-01-thanksgiving-boundaries.md',
    suggestedClientName: 'Daniel R.',
  },
];

export async function loadSample(sample: SampleTranscript): Promise<string> {
  const response = await fetch(sample.path);
  if (!response.ok) throw new Error('Could not load the sample transcript');
  return response.text();
}
