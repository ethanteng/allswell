import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_ANALYSIS_PROMPT, DEFAULT_FOLLOW_UP_PROMPT } from './default-prompts';
import type { SessionFeedback } from './feedback.types';
import { analyseTranscript } from './heuristic-analyser';
import { DEFAULT_MODEL } from './model-catalog';

export interface AnalysisResult {
  feedback: SessionFeedback;
  model: string;
  promptVersion: number;
  latencyMs: number;
}

export interface FollowUpResult {
  answer: string;
  model: string;
  promptVersion: number;
  latencyMs: number;
}

/**
 * Produces clinician feedback for a session.
 *
 * The model call is not wired up yet. Both methods read the live prompt config
 * so the admin page is genuinely connected — the configured model and prompt
 * version are recorded on every turn — and then fall through to the heuristic
 * analyser for the content itself. Replacing the two marked blocks with an
 * Anthropic call is the whole of the next pass.
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Reads the singleton config, falling back to defaults if it is missing. */
  private async config(): Promise<{ analysisPrompt: string; followUpPrompt: string; model: string; version: number }> {
    const config = await this.prisma.promptConfig.findUnique({ where: { id: 'default' } });

    return {
      analysisPrompt: config?.analysisPrompt ?? DEFAULT_ANALYSIS_PROMPT,
      followUpPrompt: config?.followUpPrompt ?? DEFAULT_FOLLOW_UP_PROMPT,
      model: config?.model ?? DEFAULT_MODEL,
      version: config?.version ?? 1,
    };
  }

  async analyse(transcript: string): Promise<AnalysisResult> {
    const startedAt = Date.now();
    const { model, version } = await this.config();

    // TODO(llm): send `analysisPrompt` + transcript to Anthropic here and parse
    // the response into SessionFeedback. Until then, cite real transcript lines
    // so the response UI is exercised with genuine data.
    const feedback = analyseTranscript(transcript);

    return { feedback, model, promptVersion: version, latencyMs: Date.now() - startedAt };
  }

  async followUp(question: string, transcript: string, priorFeedback: SessionFeedback | null): Promise<FollowUpResult> {
    const startedAt = Date.now();
    const { model, version } = await this.config();

    // TODO(llm): send `followUpPrompt`, the transcript, the prior feedback, and
    // the question to Anthropic here.
    const answer = this.stubFollowUpAnswer(question, transcript, priorFeedback);

    return { answer, model, promptVersion: version, latencyMs: Date.now() - startedAt };
  }

  /**
   * Stand-in answer for a follow-up.
   *
   * It searches the transcript for the question's own terms and quotes what it
   * finds, so the follow-up thread shows real citations rather than lorem
   * ipsum. It is explicit about being a placeholder — a plausible-sounding fake
   * answer about a clinical session would be worse than an obvious one.
   */
  private stubFollowUpAnswer(question: string, transcript: string, priorFeedback: SessionFeedback | null): string {
    const terms = question
      .toLowerCase()
      .split(/[^a-z0-9']+/)
      .filter((term) => term.length > 4);

    const hits = transcript
      .split(/\r?\n/)
      .filter((line) => line.trim() && terms.some((term) => line.toLowerCase().includes(term)))
      .slice(0, 4);

    const lines: string[] = [
      '_Placeholder response — the model call is not wired up yet, so this is a transcript search rather than clinical reasoning._',
      '',
      `**Your question:** ${question}`,
      '',
    ];

    if (hits.length > 0) {
      lines.push('Moments in the transcript matching that question:', '');
      // Blank line between each, or markdown merges them into one blockquote.
      for (const hit of hits) lines.push(`> ${hit.trim()}`, '');
    } else {
      lines.push('No lines in the transcript matched the terms in that question.', '');
    }

    if (priorFeedback) {
      lines.push(
        `The analysis on this session recorded ${priorFeedback.strengths.length} strengths and ${priorFeedback.growthAreas.length} growth areas; a real follow-up would reason over those alongside the transcript.`,
      );
    }

    return lines.join('\n');
  }
}
