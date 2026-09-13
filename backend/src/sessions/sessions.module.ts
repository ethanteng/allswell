import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [AnalysisModule],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
