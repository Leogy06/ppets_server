import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: DatabaseService) {}

  async findAll() {
    const employees = await this.prisma.employee.findMany({
      where: {
        DELETED: 0,
      },
    });

    return employees;
  }
}
