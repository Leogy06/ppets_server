import {
  Body,
  Controller,
  Delete,
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
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ExtendRequest } from 'src/user/dto/create-user.dto';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
} from 'src/schemas/employee.schema';

@UseGuards(JwtAuthGuard)
@Controller('api/employee')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

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

  @Get('archived/:pageIndex/:pageSize')
  async findAllArchived(
    @Param('pageIndex', ParseIntPipe) pageIndex: number,
    @Param('pageSize', ParseIntPipe) pageSize: number,
    @Query('employeeName') employeeName: string,
    @Req() req: ExtendRequest,
  ) {
    return await this.employeeService.findAllArchived(
      pageIndex,
      pageSize,
      req,
      employeeName,
    );
  }

  @Post()
  async create(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @Req() req: ExtendRequest,
  ) {
    return await this.employeeService.create(createEmployeeDto, req);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return await this.employeeService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe)
    id: number,
    @Body()
    updateEmployeeUserDto: UpdateEmployeeDto,
    @Req()
    req: ExtendRequest,
  ) {
    return await this.employeeService.update(id, updateEmployeeUserDto, req);
  }

  @Delete(':employeeId')
  async deleteEmployee(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Req() req: ExtendRequest,
  ) {
    return await this.employeeService.delete(employeeId, req);
  }

  @Put('restore/:employeeId')
  async restoreEmployee(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Req() req: ExtendRequest,
  ) {
    return await this.employeeService.restore(employeeId, req);
  }
}
