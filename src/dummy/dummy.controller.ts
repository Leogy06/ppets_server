import { Body, Controller, Post, Req } from '@nestjs/common';
import { DummyService } from './dummy.service';
import { CreateEmployeeDto } from 'src/schemas/employee.schema';
import { CreateItemDto } from 'src/schemas/item.schema';
import { CreateUserDto, ExtendRequest } from 'src/user/dto/create-user.dto';

@Controller('api/dummy')
export class DummyController {
  constructor(private readonly dummyServicer: DummyService) {}

  @Post('employees')
  async createEmployees(@Body('employees') employees: CreateEmployeeDto[]) {
    return this.dummyServicer.createEmployees(employees);
  }

  @Post('items')
  async createItems(@Body('items') items: CreateItemDto[]) {
    return this.dummyServicer.createItems(items);
  }

  @Post('users')
  async createUsers(@Body('users') users: CreateUserDto[]) {
    return this.dummyServicer.createUser(users);
  }
}
