import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestWithUser } from './current-user.decorator';

/**
 * Gates the admin routes. Always stacked *after* JwtAuthGuard, which is what
 * puts `user` on the request; on its own this guard would let everyone through.
 *
 * The privilege is re-read from the database rather than taken from the token's
 * `isAdmin` claim. Tokens live for seven days, so trusting the claim would let
 * a revoked admin keep rewriting the deployment-wide prompt configuration for
 * up to a week after the flag was cleared. Hiding the admin UI is not a control
 * — the API is callable directly. This costs one indexed lookup on a handful of
 * low-traffic routes, which is why it is here and not in JwtAuthGuard.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.id;
    if (!userId) throw new ForbiddenException('Admin access required');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) throw new ForbiddenException('Admin access required');

    // Keep the request in step with storage for anything downstream.
    request.user = { ...request.user!, isAdmin: true };
    return true;
  }
}
