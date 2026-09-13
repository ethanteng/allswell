import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto, RegisterDto } from './dto/auth.dto';

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; name: string | null; isAdmin: boolean };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Emails listed in ADMIN_EMAILS become admins on registration.
   *
   * Env-driven rather than a self-service flag so nobody can register their way
   * into editing the prompt everyone else's feedback is generated from.
   */
  private isAdminEmail(email: string): boolean {
    const allowlist = (this.config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);

    return allowlist.includes(email.toLowerCase());
  }

  private async sign(user: { id: string; email: string; isAdmin: boolean }): Promise<string> {
    return this.jwt.signAsync({ sub: user.id, email: user.email, isAdmin: user.isAdmin });
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();

    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('An account with that email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(dto.password, 12),
        name: dto.name?.trim() || null,
        isAdmin: this.isAdminEmail(email),
      },
    });

    return {
      token: await this.sign(user),
      user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin },
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Same message and roughly the same work whether or not the account exists,
    // so this endpoint can't be used to enumerate registered clinicians.
    const passwordMatches = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Incorrect email or password');
    }

    return {
      token: await this.sign(user),
      user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin },
    };
  }

  /** Backs GET /auth/me — re-reads the row so a revoked admin flag takes effect. */
  async me(userId: string): Promise<AuthResponse['user']> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Account no longer exists');

    return { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin };
  }
}
