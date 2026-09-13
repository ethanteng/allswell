import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Global so JwtAuthGuard can be applied in any module without each one
 * re-importing JwtModule with the same signing config.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // Cast because @nestjs/jwt types expiresIn as ms's literal StringValue
        // union, which an env-var string can never satisfy statically.
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '7d' } as JwtSignOptions,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule],
})
export class AuthModule {}
