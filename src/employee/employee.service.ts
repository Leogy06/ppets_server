import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { ExtendRequest } from 'src/user/dto/create-user.dto';

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: DatabaseService) {}

  async findAll(
    pageIndex: number = 1,
    pageSize: number = 5,
    req: ExtendRequest,
    employeeName?: string,
  ) {
    const skip = (pageIndex - 1) * pageSize;

    const loggedInEmployee = await this.prisma.employee.findUnique({
      where: {
        ID: req.user.employeeId,
      },
    });

    const count = await this.prisma.employee.count({
      where: {
        DEPARTMENT_ID: loggedInEmployee?.DEPARTMENT_ID,
      },
    });

    const employees = await this.prisma.employee.findMany({
      where: {
        DEPARTMENT_ID: loggedInEmployee?.DEPARTMENT_ID,
        ...(employeeName && employeeName.trim() !== ''
          ? {
              LASTNAME: {
                contains: employeeName,
              },
              FIRSTNAME: {
                contains: employeeName,
              },
            }
          : {}),
      },
      skip,
      take: pageSize,
      orderBy: { LASTNAME: 'asc' },
    });

    return { employees, count };
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
