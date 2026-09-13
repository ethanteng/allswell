import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AnalysisModule } from './analysis/analysis.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { PrismaModule } from './prisma/prisma.module';
import { SessionsModule } from './sessions/sessions.module';

/** Unauthenticated liveness probe for Render. */
@Controller()
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AnalysisModule,
    ClientsModule,
    SessionsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
