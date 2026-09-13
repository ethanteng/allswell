import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Logger } from '@nestjs/common';
import type { z } from 'zod';

/**
 * Thin wrapper over the Anthropic SDK for the analysis calls.
 *
 * Its job beyond calling the API is to keep an admin's model choice from
 * breaking the request: the model is picked from a catalog at runtime, and the
 * parameters different generations accept are not the same. Sending one a model
 * rejects fails the whole call, which would look like the feature being broken
 * rather than a setting being wrong.
 */

const logger = new Logger('ClaudeClient');

let client: Anthropic | null = null;

/** True when a key is configured. Callers fall back rather than failing hard. */
export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function getClient(): Anthropic {
  if (!client) {
    if (!hasApiKey()) {
      throw new Error('ANTHROPIC_API_KEY is not set; cannot call the model.');
    }

    // An organisation-level key has no workspace of its own, so every request
    // made with one must name the workspace to bill and scope it to. A
    // workspace-scoped key carries that already and needs no header. Setting
    // the variable is therefore optional, and sending an empty one would be a
    // 400 in the other direction.
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();

    client = new Anthropic({
      ...(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {}),
    });
  }
  return client;
}

/**
 * Whether a model takes adaptive thinking and `output_config.effort`.
 *
 * Both arrived with the 4.6 generation. Haiku 4.5 is in the admin catalog and
 * rejects them, so sending them unconditionally would make that a model an
 * admin can select but never successfully use. An id that doesn't parse is
 * treated as older: omitting the parameters costs tuning, sending them to a
 * model that refuses them costs the entire call.
 */
export function supportsAdaptiveThinking(model: string): boolean {
  const match = /^claude-(?:opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d+))?(?:-|$)/.exec(model.trim());
  if (!match) return false;

  const major = Number(match[1]);
  const minor = match[2] === undefined ? 0 : Number(match[2]);
  return major >= 5 || (major === 4 && minor >= 6);
}

/**
 * The mirror image: sampling parameters were removed in the same generation
 * that added thinking, so `temperature` is a 400 on exactly the models that
 * accept `effort`. The admin page exposes temperature because older models
 * honour it; this is what keeps it from reaching one that doesn't.
 */
export function acceptsTemperature(model: string): boolean {
  return !supportsAdaptiveThinking(model);
}

/**
 * A response that stopped at `max_tokens` is a partial answer. With structured
 * output that usually means unparseable JSON, which surfaces as a confusing
 * schema error rather than "the budget was too small" — so name it.
 */
function warnIfTruncated(stopReason: string | null | undefined, model: string): void {
  if (stopReason === 'max_tokens') {
    logger.warn(`Response truncated at max_tokens (model=${model}). Raise maxTokens in the admin settings.`);
  }
}

/** A safety decline is an outcome to report, not an exception to swallow. */
function throwIfRefused(message: Anthropic.Message): void {
  if (message.stop_reason !== 'refusal') return;

  const category = message.stop_details?.type === 'refusal' ? message.stop_details.category : null;
  throw new Error(
    `The model declined to analyse this transcript${category ? ` (${category})` : ''}. ` +
      'This can happen with difficult clinical content; try re-running, or review the session manually.',
  );
}

/**
 * Turns a credentials or configuration failure into a message that says so.
 *
 * These arrive as raw API JSON, and the clinician sees whatever we store on the
 * session. "This API key is not scoped to a workspace" reads as the feature
 * being broken; it is the deploy being misconfigured, and the person who can
 * act on it is not the one reading it. The full error is logged either way, so
 * nothing is lost for whoever does go looking.
 */
function describeApiError(error: unknown): unknown {
  if (!(error instanceof Anthropic.APIError)) return error;

  const configProblem =
    error.status === 401 ||
    error.status === 403 ||
    (error.status === 400 && /api key|workspace/i.test(error.message));

  logger.error(`Anthropic API error (status=${error.status ?? 'none'}): ${error.message}`);
  if (!configProblem) return error;

  // Worded to be true on both call sites: an analysis that failed, and a
  // follow-up that went unanswered. Naming the transcript here would be wrong
  // on the second — by then it has been saved for a while.
  return new Error(
    'The analysis service is not configured correctly, so this could not be completed. ' +
      'An administrator needs to check its API credentials. Nothing you entered has been lost.',
  );
}

export interface CallOptions {
  model: string;
  maxTokens: number;
  temperature: number;
}

/**
 * Parameters that vary by model generation, kept separate from `output_config`
 * so a caller that also needs `output_config` (structured output) composes the
 * two explicitly rather than having one silently overwrite the other.
 */
function generationParams({ model, temperature }: CallOptions) {
  return {
    ...(supportsAdaptiveThinking(model) ? { thinking: { type: 'adaptive' as const } } : {}),
    ...(acceptsTemperature(model) ? { temperature } : {}),
  };
}

/**
 * Clinical judgement is intelligence-sensitive work, so this asks for depth
 * rather than leaving it at the default. Omitted on models that reject it.
 */
function effortConfig(model: string): { effort: 'high' } | Record<string, never> {
  return supportsAdaptiveThinking(model) ? { effort: 'high' } : {};
}

/** Runs a streamed request, reporting a credentials failure as one. */
async function finalMessage(start: () => { finalMessage(): Promise<Anthropic.Message> }): Promise<Anthropic.Message> {
  try {
    return await start().finalMessage();
  } catch (error) {
    throw describeApiError(error);
  }
}

/**
 * Runs a prompt whose response is constrained to `schema`.
 *
 * Streamed rather than awaited in one piece: a full session transcript is a
 * large input and the reply is long, which is the shape that hits request
 * timeouts. The structured-output format constrains the response on the wire,
 * and it is validated again here — the schema is the contract the UI renders
 * against, so it is worth checking rather than trusting.
 */
export async function callStructured<Schema extends z.ZodType>(
  system: string,
  userMessage: string,
  schema: Schema,
  options: CallOptions,
): Promise<z.infer<Schema>> {
  const message = await finalMessage(() =>
    getClient().messages.stream({
      model: options.model,
      max_tokens: options.maxTokens,
      ...generationParams(options),
      output_config: { ...effortConfig(options.model), format: zodOutputFormat(schema) },
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  );
  throwIfRefused(message);
  warnIfTruncated(message.stop_reason, options.model);

  const text = message.content.find((block): block is Anthropic.TextBlock => block.type === 'text')?.text;
  if (!text) throw new Error('The model returned no content.');

  return schema.parse(JSON.parse(text)) as z.infer<Schema>;
}

/** Runs a prompt whose response is prose. Used for follow-up answers. */
export async function callText(system: string, userMessage: string, options: CallOptions): Promise<string> {
  const message = await finalMessage(() =>
    getClient().messages.stream({
      model: options.model,
      max_tokens: options.maxTokens,
      ...generationParams(options),
      ...(supportsAdaptiveThinking(options.model) ? { output_config: effortConfig(options.model) } : {}),
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  );
  throwIfRefused(message);
  warnIfTruncated(message.stop_reason, options.model);

  const text = message.content.find((block): block is Anthropic.TextBlock => block.type === 'text')?.text;
  if (!text?.trim()) throw new Error('The model returned no content.');

  return text;
}
