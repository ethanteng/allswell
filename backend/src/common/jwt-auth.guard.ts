import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser, RequestWithUser } from './current-user.decorator';

/** Claims we sign in auth.service. */
interface JwtPayload {
  sub: string;
  email: string;
  isAdmin: boolean;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(header.slice('Bearer '.length));
      const user: AuthUser = { id: payload.sub, email: payload.email, isAdmin: payload.isAdmin };
      request.user = user;
      return true;
    } catch {
      // Expired and malformed tokens are the same thing to the client: log in
      // again. Distinguishing them here would leak token state to an attacker.
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
