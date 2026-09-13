/**
 * Models offered in the admin picker.
 *
 * Hard-coded rather than fetched so the admin page works before an Anthropic
 * key exists. When the real call lands, this can be replaced by a cached
 * `GET /v1/models` lookup; the shape is already what the picker renders.
 */
export interface ModelOption {
  id: string;
  label: string;
  /** Shown under the option so the choice is not made blind. */
  note: string;
  recommended: boolean;
}

export const MODEL_CATALOG: ModelOption[] = [
  {
    id: 'claude-sonnet-5',
    label: 'Claude Sonnet 5',
    note: 'The default. Strong clinical reasoning at a fraction of Opus pricing.',
    recommended: true,
  },
  {
    id: 'claude-opus-5',
    label: 'Claude Opus 5',
    note: 'Strongest reasoning. Worth comparing against on subtle sessions.',
    recommended: true,
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    note: 'Fastest and cheapest. 200K context, so very long transcripts may not fit. Older generation: it takes the temperature setting, and ignores thinking effort.',
    recommended: false,
  },
  {
    id: 'claude-opus-4-8',
    label: 'Claude Opus 4.8',
    note: 'Previous Opus generation. Useful as a comparison point.',
    recommended: false,
  },
];

export const DEFAULT_MODEL = 'claude-sonnet-5';

export function isKnownModel(id: string): boolean {
  return MODEL_CATALOG.some((option) => option.id === id);
}
