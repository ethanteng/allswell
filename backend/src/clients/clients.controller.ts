import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto, ReorderSessionsDto, UpdateClientDto } from './dto/client.dto';

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.clients.listWithSessions(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateClientDto) {
    return this.clients.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clients.update(user.id, id, dto);
  }

  /** Returns the whole nav, so the caller reconciles against one payload. */
  @Patch(':id/session-order')
  reorderSessions(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReorderSessionsDto,
  ) {
    return this.clients.reorderSessions(user.id, id, dto.sessionIds);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clients.remove(user.id, id);
  }
}
