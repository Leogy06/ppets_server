import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: DatabaseService) {}

  async create(departmentDto: Prisma.departmentTablesCreateInput) {
    return await this.prisma.departmentTables.create({
      data: departmentDto,
    });
  }

  async findAll() {
    return await this.prisma.departmentTables.findMany();
  }
}
