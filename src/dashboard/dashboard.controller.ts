import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { ExtendRequest } from 'src/user/dto/create-user.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('api/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Roles(1)
  async dashboard(@Req() req: ExtendRequest) {
    const { employeeId } = req.user;

    return await this.dashboardService.dashboard(employeeId);
  }
}
