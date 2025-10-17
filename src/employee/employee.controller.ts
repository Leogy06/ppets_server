import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { Prisma } from '@prisma/client';

@Controller('api/employee')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  async findAll() {
    return await this.employeeService.findAll();
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
