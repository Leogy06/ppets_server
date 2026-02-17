import { Body, Controller, Get, Post } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { Prisma } from '@prisma/client';

@Controller('api/department')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post()
  async create(
    @Body() createDepartmentDto: Prisma.departmentTablesCreateInput,
  ) {
    return await this.departmentService.create({
      ...createDepartmentDto,
      ENTRY_DATE: new Date(),
    });
  }

  @Get()
  async findAll() {
    return await this.departmentService.findAll();
  }
}
