import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CreateSessionDto, FollowUpDto, UpdateSessionDto } from './dto/session.dto';
import { SessionsService } from './sessions.service';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.findOne(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSessionDto) {
    return this.sessions.create(user.id, dto);
  }

  /** Re-run after an admin prompt or model change. */
  @Post(':id/analyze')
  reanalyze(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.runAnalysis(user.id, id);
  }

  @Post(':id/turns')
  followUp(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: FollowUpDto) {
    return this.sessions.askFollowUp(user.id, id, dto);
  }

  /** Rename, move to another client, or set the session date. */
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.sessions.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.remove(user.id, id);
  }
}
