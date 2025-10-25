import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ExtendRequest } from 'src/user/dto/create-user.dto';

@Controller('api/employee')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':pageIndex/:pageSize')
  async findAll(
    @Param('pageIndex', ParseIntPipe) pageIndex: number,
    @Param('pageSize', ParseIntPipe) pageSize: number,
    @Query('employeeName') employeeName: string,
    @Req() req: ExtendRequest,
  ) {
    return await this.employeeService.findAll(
      pageIndex,
      pageSize,
      req,
      employeeName,
    );
  }

  @Post()
  async create(@Body() createUserDto: Prisma.employeeCreateInput) {
    return await this.employeeService.create(createUserDto);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.employeeService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe)
    id: number,
    @Body()
    updateEmployeeUserDto: Prisma.employeeUpdateInput,
  ) {
    return await this.employeeService.update(id, updateEmployeeUserDto);
  }
}
