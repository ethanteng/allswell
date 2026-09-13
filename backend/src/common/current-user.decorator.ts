import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Shape JwtAuthGuard attaches to the request after verifying the token. */
export interface AuthUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

export type RequestWithUser = Request & { user?: AuthUser };

/**
 * Reads the user JwtAuthGuard put on the request.
 *
 * Only ever used on routes behind that guard, so by the time this runs the
 * user is present; the throw is a wiring check, not a runtime path.
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  if (!request.user) {
    throw new Error('CurrentUser used on a route that is not behind JwtAuthGuard');
  }
  return request.user;
});
