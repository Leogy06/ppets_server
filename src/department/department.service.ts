import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: DatabaseService) {}

  async create(departmentDto: Prisma.department_tableCreateInput) {
    return await this.prisma.department_table.create({
      data: departmentDto,
    });
  }

  async findAll() {
    return await this.prisma.department_table.findMany();
  }
}
