import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, SessionStatus, TurnKind } from '@prisma/client';
import { AnalysisService } from '../analysis/analysis.service';
import type { SessionFeedback } from '../analysis/feedback.types';
import { isTherapist, parseTranscript } from '../analysis/transcript';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSessionDto, FollowUpDto, UpdateSessionDto } from './dto/session.dto';
import { isRename } from './session-rules';

const SESSION_WITH_TURNS = {
  turns: { orderBy: { createdAt: 'asc' } },
  client: { select: { id: true, name: true } },
} satisfies Prisma.SessionInclude;

/**
 * Cues for the turn where a session states what it is about. Ordered scanning
 * of these beats position alone, which lands on the greeting or the audio check.
 */
const AGENDA_MARKERS: RegExp[] = [
  /\blast (time|week|session)\b/i,
  /\bwe ended with\b/i,
  /\bwhere would you like to (begin|start)\b/i,
  /\bwhat would you like to (work on|focus on|talk about|bring)\b/i,
  /\byou wanted to (talk about|come back to)\b/i,
  /\bwhat (brings|brought) you\b/i,
  /\bwhat\u2019s on your mind\b/i,
];

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analysis: AnalysisService,
  ) {}

  private async ownedOrThrow(userId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
      include: SESSION_WITH_TURNS,
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  /**
   * Names a session from the clinician line that best identifies what it was
   * about.
   *
   * A transcript rarely carries a title, and "Session 3" tells the clinician
   * nothing in a list. The literal opening line is no better — it is always a
   * greeting or an audio check — so the first minute is skipped and the
   * agenda-setting turn after it is preferred.
   *
   * A successful analysis replaces this with a title the model wrote, which
   * reads better. This still runs first and stays the name of any session the
   * model never got to: one analysed without an API key, and — the case that
   * matters — one whose analysis failed. "Untitled session" at the moment a
   * clinician is looking for the session to retry would be the worst time for
   * it.
   */
  private deriveTitle(transcript: string): string {
    const clinicianLines = parseTranscript(transcript).filter(isTherapist);

    const candidate =
      // The agenda-setting turn names the session better than anything else in
      // it: "last time we ended with…", "where would you like to begin".
      clinicianLines.find((line) => AGENDA_MARKERS.some((marker) => marker.test(line.text)) && line.text.length > 50) ??
      // Otherwise take the first substantial turn past the opening pleasantries,
      // which are always greetings, audio checks, and frame questions.
      clinicianLines.find((line) => (line.seconds ?? 0) >= 90 && line.text.length > 60) ??
      // Untimed transcripts, or a session that gets to business immediately.
      clinicianLines.find((line) => line.text.length > 60) ??
      clinicianLines.find((line) => line.text.length > 40);

    if (!candidate) return 'Untitled session';

    const collapsed = candidate.text.replace(/\s+/g, ' ').trim();
    return collapsed.length > 80 ? `${collapsed.slice(0, 80).trimEnd()}…` : collapsed;
  }

  /**
   * Resolves which client a new session belongs to, creating one when needed.
   *
   * Throws rather than silently filing under a new client if a clientId was
   * given but isn't the caller's — quietly relocating a session would be worse
   * than an error.
   */
  private async resolveClientId(userId: string, dto: CreateSessionDto): Promise<string> {
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({ where: { id: dto.clientId, userId } });
      if (!client) throw new NotFoundException('Client not found');
      return client.id;
    }

    const created = await this.prisma.client.create({
      data: { userId, name: dto.newClientName?.trim() || 'New client' },
    });
    return created.id;
  }

  /** Everything the workspace needs for one session, turns included. */
  async findOne(userId: string, sessionId: string) {
    return this.ownedOrThrow(userId, sessionId);
  }

  /**
   * Creates the session and runs the first analysis.
   *
   * Analysis is inline because the stub is synchronous and fast. Once a real
   * model call replaces it this should move to a queue and the ANALYZING status
   * — already in the schema — becomes the state the UI polls on.
   */
  /**
   * Where a session arriving in a client should sit: above everything already
   * there.
   *
   * Going one below the current minimum keeps this to a single read, where
   * "renumber everything from 1" would be a write per existing session. The
   * numbers drift negative and non-contiguous, which costs nothing — they are
   * sort keys, and a reorder rewrites them contiguously anyway.
   */
  private async topPosition(clientId: string): Promise<number> {
    const top = await this.prisma.session.aggregate({
      where: { clientId },
      _min: { position: true },
    });
    return (top._min.position ?? 0) - 1;
  }

  async create(userId: string, dto: CreateSessionDto) {
    const transcript = dto.transcript.trim();
    const clientId = await this.resolveClientId(userId, dto);

    const session = await this.prisma.session.create({
      data: {
        userId,
        clientId,
        // A title sent with the transcript was chosen, not derived, so it is
        // the clinician's — the analysis must not replace it moments later.
        title: dto.title?.trim() || this.deriveTitle(transcript),
        titleCustom: Boolean(dto.title?.trim()),
        position: await this.topPosition(clientId),
        transcript,
        sessionDate: dto.sessionDate ? new Date(dto.sessionDate) : null,
        status: SessionStatus.ANALYZING,
      },
    });

    return this.runAnalysis(userId, session.id);
  }

  /**
   * Produces the ANALYSIS turn. Safe to call again: re-running after an admin
   * prompt change replaces the previous analysis and clears the follow-up
   * thread, since those answers were written against feedback that no longer
   * exists.
   */
  async runAnalysis(userId: string, sessionId: string) {
    const session = await this.ownedOrThrow(userId, sessionId);

    await this.prisma.session.update({
      where: { id: session.id },
      data: { status: SessionStatus.ANALYZING, errorMessage: null },
    });

    try {
      const result = await this.analysis.analyse(session.transcript);

      /*
       * A rename is a deliberate act; a re-run (after an admin changes the
       * prompt or model) is not a reason to undo one.
       *
       * The check belongs in the WHERE clause rather than in a `titleCustom`
       * read from before the call. A real analysis takes the better part of a
       * minute — measured at 51s against production — and the edit dialog stays
       * open throughout. A clinician who renames the session while it runs
       * would otherwise have that name overwritten on completion by a snapshot
       * taken before they typed it.
       */
      const titleWrite =
        result.title === null
          ? []
          : [
              this.prisma.session.updateMany({
                where: { id: session.id, titleCustom: false },
                data: { title: result.title },
              }),
            ];

      await this.prisma.$transaction([
        ...titleWrite,
        this.prisma.turn.deleteMany({ where: { sessionId: session.id } }),
        this.prisma.turn.create({
          data: {
            sessionId: session.id,
            kind: TurnKind.ANALYSIS,
            feedback: result.feedback as unknown as Prisma.InputJsonValue,
            model: result.model,
            promptVersion: result.promptVersion,
            latencyMs: result.latencyMs,
          },
        }),
        this.prisma.session.update({
          where: { id: session.id },
          data: { status: SessionStatus.COMPLETE, errorMessage: null },
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Analysis failed';
      this.logger.error(`Analysis failed for session ${session.id}: ${message}`);

      await this.prisma.session.update({
        where: { id: session.id },
        data: { status: SessionStatus.FAILED, errorMessage: message },
      });
    }

    return this.ownedOrThrow(userId, session.id);
  }

  /** Appends a follow-up turn to the session's thread. */
  async askFollowUp(userId: string, sessionId: string, dto: FollowUpDto) {
    const session = await this.ownedOrThrow(userId, sessionId);

    const analysisTurn = session.turns.find((turn) => turn.kind === TurnKind.ANALYSIS);
    if (!analysisTurn) {
      throw new BadRequestException('Run the analysis before asking a follow-up');
    }

    const priorFeedback = (analysisTurn.feedback as unknown as SessionFeedback | null) ?? null;

    /*
     * The analysis path records a failure on the session and the UI reads it
     * from there. A follow-up has nothing to record it on — there is no turn
     * until the answer exists — so the message has to travel as the response.
     *
     * Letting the error escape gives Nest's default filter a plain `Error`,
     * which it reports as `500 Internal server error`. That throws away every
     * message this feature is careful about: what a refusal was, that the
     * credentials are misconfigured, that the transcript is still saved.
     */
    let result: Awaited<ReturnType<AnalysisService['followUp']>>;
    try {
      result = await this.analysis.followUp(dto.question.trim(), session.transcript, priorFeedback);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The follow-up could not be answered';
      this.logger.error(`Follow-up failed for session ${session.id}: ${message}`);
      throw new ServiceUnavailableException(message);
    }

    await this.prisma.turn.create({
      data: {
        sessionId: session.id,
        kind: TurnKind.FOLLOW_UP,
        question: dto.question.trim(),
        answer: result.answer,
        model: result.model,
        promptVersion: result.promptVersion,
        latencyMs: result.latencyMs,
      },
    });

    return this.ownedOrThrow(userId, session.id);
  }

  /** Renames a session, moves it between clients, or both. */
  async update(userId: string, sessionId: string, dto: UpdateSessionDto) {
    const session = await this.ownedOrThrow(userId, sessionId);

    if (dto.clientId) {
      const target = await this.prisma.client.findFirst({ where: { id: dto.clientId, userId } });
      if (!target) throw new NotFoundException('Target client not found');
    }

    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        // Naming it by hand takes the title out of the analyser's hands for
        // good — but only an actual rename counts, since the edit dialog
        // resubmits the unchanged title alongside a date the clinician did
        // change.
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(isRename(session.title, dto.title) ? { titleCustom: true } : {}),
        // A moved session arrives at the top of its new client. Keeping its old
        // position would drop it at an arbitrary depth in a list it has never
        // been part of, which reads as the move having half-failed.
        ...(dto.clientId !== undefined
          ? { clientId: dto.clientId, position: await this.topPosition(dto.clientId) }
          : {}),
        ...(dto.sessionDate !== undefined ? { sessionDate: dto.sessionDate ? new Date(dto.sessionDate) : null } : {}),
      },
      include: SESSION_WITH_TURNS,
    });
  }

  async remove(userId: string, sessionId: string) {
    await this.ownedOrThrow(userId, sessionId);
    await this.prisma.session.delete({ where: { id: sessionId } });
    return { id: sessionId, deleted: true };
  }
}
