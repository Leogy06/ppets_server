import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: DatabaseService) {}

  async findByUsername(username: string) {
    return await this.prisma.users.findUnique({ where: { username } });
  }

  // * CREATE NEW USER
  async create(createUserDto: CreateUserDto) {
    //check if user is also an employee
    const isEmployee = await this.prisma.employee.findUnique({
      where: {
        ID: createUserDto.emp_id,
      },
    });

    return await this.prisma.users.create({
      data: {
        ...createUserDto,
      },
    });
  }
}
