import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/admin.guard';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { AdminService } from './admin.service';
import { UpdatePromptConfigDto } from './dto/admin.dto';

/** Guard order matters: JwtAuthGuard populates the user AdminGuard checks. */
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('config')
  getConfig() {
    return this.admin.getConfig();
  }

  @Put('config')
  updateConfig(@CurrentUser() user: AuthUser, @Body() dto: UpdatePromptConfigDto) {
    return this.admin.updateConfig(dto, user.email);
  }
}
