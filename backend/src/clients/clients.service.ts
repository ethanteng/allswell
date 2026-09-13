import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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

  /** The left nav: every client with its sessions, newest session first. */
  async listWithSessions(userId: string) {
    return this.prisma.client.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        sessions: {
          orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }],
          select: { id: true, title: true, status: true, sessionDate: true, createdAt: true, updatedAt: true },
        },
      },
    });
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
