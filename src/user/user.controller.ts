import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('api/user')
@UseGuards(JwtAuthGuard, RolesGuard) // reverse
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return await this.userService.create(createUserDto);
  }

  @Get('user-employee/:empId')
  @Roles(1)
  async userEmployee(@Param('empId', ParseIntPipe) empId: number) {
    return await this.userService.getUserEmployee(empId);
  }

  @Put('update/active-status/:userId')
  @Roles(1)
  async updateActiveStatus(
    @Param('userId', ParseIntPipe) userId: number,
    @Body('activeStatus') activeStatus: number,
  ) {
    return this.userService.updateUserActiveStatus(userId, activeStatus);
  }

  @Post('create/user-employee')
  @Roles(1) // admin only
  async adminCreatUser(
    @Body('empId') empId: number,
    @Body('role') role: number,
  ) {
    return await this.userService.adminCreateUser(empId, role);
  }
}
