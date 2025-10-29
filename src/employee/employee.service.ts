import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
} from 'src/schemas/employee.schema';
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

    if (!loggedInEmployee) throw new NotFoundException('Employee not found.');

    const count = await this.prisma.employee.count({
      where: {
        DELETED: 0,
        CURRENT_DPT_ID: loggedInEmployee?.CURRENT_DPT_ID,
      },
    });

    const employees = await this.prisma.employee.findMany({
      where: {
        DELETED: 0,
        CURRENT_DPT_ID: loggedInEmployee?.CURRENT_DPT_ID,
        ...(employeeName && employeeName.trim() !== ''
          ? {
              OR: [
                {
                  LASTNAME: {
                    contains: employeeName,
                  },
                },
                {
                  FIRSTNAME: {
                    contains: employeeName,
                  },
                },
              ],
            }
          : {}),
      },
      skip,
      take: pageSize,
      orderBy: { LASTNAME: 'asc' },
    });

    return { count, employees };
  }

  async findAllArchived(
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
        DELETED: 1,
        DEPARTMENT_ID: loggedInEmployee?.DEPARTMENT_ID,
      },
    });

    const employees = await this.prisma.employee.findMany({
      where: {
        DELETED: 1,
        DEPARTMENT_ID: loggedInEmployee?.DEPARTMENT_ID,
        ...(employeeName && employeeName.trim() !== ''
          ? {
              OR: [
                {
                  LASTNAME: {
                    contains: employeeName,
                  },
                },
                {
                  FIRSTNAME: {
                    contains: employeeName,
                  },
                },
              ],
            }
          : {}),
      },
      skip,
      take: pageSize,
      orderBy: { LASTNAME: 'asc' },
    });

    return { count, employees };
  }

  async create(createEmployeeDto: CreateEmployeeDto, req: ExtendRequest) {
    const loggedInEmployee = await this.prisma.employee.findUnique({
      where: {
        ID: req.user.employeeId,
      },
    });

    if (!loggedInEmployee)
      throw new NotFoundException('Employee logged in not found.');

    //check if id number already exist
    const isIdNumberDup = await this.prisma.employee.findFirst({
      where: {
        ID_NUMBER: createEmployeeDto.ID_NUMBER,
      },
    });

    if (isIdNumberDup)
      throw new BadRequestException('ID number already exist.');

    return await this.prisma.employee.create({
      data: {
        ...createEmployeeDto,
        CURRENT_DPT_ID: loggedInEmployee?.DEPARTMENT_ID,
        DEPARTMENT_ID: loggedInEmployee?.DEPARTMENT_ID,
        DELETED: 0,
        CREATED_BY: loggedInEmployee.ID,
        CREATED_WHEN: new Date(),
        UPDATED_WHEN: new Date(),
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
    id: number,
    updateEmployeeDto: UpdateEmployeeDto,
    req: ExtendRequest,
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
        ...updateEmployeeDto,
        UPDATED_BY: req.user.employeeId, // update by admin
        UPDATED_WHEN: new Date(), // update now
      },
    });

    return updatedEmployee;
  }

  async delete(employeeId: number, req: ExtendRequest) {
    if (!employeeId) throw new BadRequestException('Employee ID is missing.');

    //deactivates employee's accounts
    const deactEmployeeAccounts = await this.prisma.users.updateMany({
      where: {
        emp_id: employeeId,
      },
      data: {
        is_active: 0,
      },
    });
    //deactivate employee
    const deactEmployee = await this.prisma.employee.update({
      where: {
        ID: employeeId,
      },
      data: {
        DELETED: 1,
        UPDATED_BY: req.user.employeeId,
        UPDATED_WHEN: new Date(),
      },
    });

    return {
      deactEmployeeAccounts,
      deactEmployee,
    };
  }

  async restore(employeeId: number, req: ExtendRequest) {
    if (!employeeId) throw new BadRequestException('Employee ID is missing.');

    //restores employee's accounts
    const restoreEmployeeAccounts = await this.prisma.users.updateMany({
      where: {
        emp_id: employeeId,
      },
      data: {
        is_active: 1, // restore
      },
    });
    //restore employee
    const restoreEmployee = await this.prisma.employee.update({
      where: {
        ID: employeeId,
      },
      data: {
        DELETED: 0, //restore 0
        UPDATED_BY: req.user.employeeId,
        UPDATED_WHEN: new Date(),
      },
    });

    return {
      restoreEmployeeAccounts,
      restoreEmployee,
    };
  }

  async createMany(createEmployeeDto: CreateEmployeeDto[]) {
    return await this.prisma.employee.createMany({
      data: createEmployeeDto.map((emp) => ({
        ...emp,
        CREATED_WHEN: new Date(),
      })),
      skipDuplicates: true,
    });
  }
}
