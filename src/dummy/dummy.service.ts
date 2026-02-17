import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateEmployeeDto } from 'src/schemas/employee.schema';
import { CreateItemDto } from 'src/schemas/item.schema';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import bcrypt from 'bcrypt';

@Injectable()
export class DummyService {
  constructor(private readonly prisma: DatabaseService) {}

  async createEmployees(employees: CreateEmployeeDto[]) {
    const createdEmployees = await this.prisma.employees.createMany({
      data: employees,
    });

    return { employeesCount: createdEmployees.count };
  }

  async createItems(items: CreateItemDto[]) {
    const createdItems = await this.prisma.items.createMany({
      data: items.map((i) => ({
        ...i,
        ADDED_BY: 1,
        originalQuantity: i.QUANTITY,
      })),
    });

    return { itemCount: createdItems.count };
  }

  async createUser(users: CreateUserDto[]) {
    return await this.prisma.users.createMany({
      data: users.map((u) => ({
        ...u,
        password: bcrypt.hashSync(u.password, 10),
      })),
    });
  }
}
