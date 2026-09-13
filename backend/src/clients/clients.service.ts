import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolveOrder } from '../sessions/session-rules';
import type { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every read and write goes through a userId-scoped lookup rather than a bare
   * findUnique on the id. That makes "not yours" indistinguishable from "does
   * not exist", which is the behaviour we want for client records.
   */
  private async ownedOrThrow(userId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, userId } });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  /**
   * The left nav: every client with its sessions in the clinician's order.
   *
   * `position` is authoritative — a new session lands at the top and can be
   * dragged anywhere from there. `createdAt` only breaks ties between rows that
   * have never been ordered relative to each other.
   */
  async listWithSessions(userId: string) {
    return this.prisma.client.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        sessions: {
          orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
          select: { id: true, title: true, status: true, sessionDate: true, createdAt: true, updatedAt: true },
        },
      },
    });
  }

  /**
   * Rewrites the order of a client's sessions.
   *
   * Takes the ids in their new order rather than one session and an index: the
   * sidebar already holds the whole list, and sending it whole means the result
   * cannot drift from what the clinician just saw.
   *
   * Ids the caller left out are not an error — another tab may have added a
   * session since this list was rendered. Those keep their relative order and
   * follow the ones that were named, which loses nothing.
   */
  async reorderSessions(userId: string, clientId: string, sessionIds: string[]) {
    await this.ownedOrThrow(userId, clientId);

    const sessions = await this.prisma.session.findMany({
      where: { clientId, userId },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      select: { id: true },
    });

    const known = new Set(sessions.map((session) => session.id));
    const unknown = sessionIds.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException(`Not this client's sessions: ${unknown.join(', ')}`);
    }

    const ordered = resolveOrder(sessions.map((session) => session.id), sessionIds);

    await this.prisma.$transaction(
      ordered.map((id, position) =>
        this.prisma.session.update({ where: { id }, data: { position } }),
      ),
    );

    return this.listWithSessions(userId);
  }

  async create(userId: string, dto: CreateClientDto) {
    return this.prisma.client.create({
      data: { userId, name: dto.name.trim(), notes: dto.notes?.trim() || null },
    });
  }

  async update(userId: string, clientId: string, dto: UpdateClientDto) {
    await this.ownedOrThrow(userId, clientId);

    return this.prisma.client.update({
      where: { id: clientId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
      },
    });
  }

  /** Cascades to the client's sessions and their turns — see schema.prisma. */
  async remove(userId: string, clientId: string) {
    await this.ownedOrThrow(userId, clientId);
    await this.prisma.client.delete({ where: { id: clientId } });
    return { id: clientId, deleted: true };
  }
}
