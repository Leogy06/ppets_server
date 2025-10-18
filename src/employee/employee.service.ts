import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  async create(createUserDto: Prisma.employeeCreateInput) {
    return await this.prisma.employee.create({
      data: {
        ...createUserDto,
        CURRENT_DPT_ID: createUserDto.DEPARTMENT_ID,
        DELETED: 0,
        // TO DO
        // ADD CREATED BY BASE ON USER LOGGED IN IN HTTP COOKIE
      },
    });
  }

  async findOne(id: number) {
    console.log('id ', id);

    if (!id) throw new BadRequestException('Employee ID is required.');

    if (isNaN(id))
      throw new BadRequestException('Employee ID must be a number.');

    const employee = await this.prisma.employee.findUnique({
      where: {
        ID: id,
      },
    });

    if (!employee) throw new NotFoundException('Employee not found.');

    return employee;
  }

  async update(
    id: Prisma.employeeWhereUniqueInput['ID'],
    updateEmployeeDto: Prisma.employeeUpdateInput,
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: {
        ID: id,
      },
    });

    if (!employee) throw new NotFoundException('Employee not found.');

    const updatedEmployee = await this.prisma.employee.update({
      where: {
        ID: id,
      },
      data: {
        ...employee,
        ...updateEmployeeDto,
      },
    });

    return updatedEmployee;
  }
}
