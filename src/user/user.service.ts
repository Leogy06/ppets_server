import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateUserDto } from './dto/create-user.dto';
import bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly prisma: DatabaseService) {}

  async findByUsername(username: string) {
    return await this.prisma.users.findUnique({
      where: { username },
    });
  }

  // * CREATE NEW USER
  async create(createUserDto: CreateUserDto) {
    //check if user is also an employee
    const isEmployee = await this.prisma.employee.findUnique({
      where: {
        ID: createUserDto.emp_id,
      },
    });

    if (!isEmployee)
      throw new BadRequestException('Register user is not employee.');

    //check if email already exist
    const isEmailExist = await this.prisma.users.findUnique({
      where: {
        email: createUserDto.email,
      },
    });

    if (isEmailExist) throw new BadRequestException('Email already exist.');

    return await this.prisma.users.create({
      data: {
        ...createUserDto,
        password: bcrypt.hashSync(createUserDto.password, 10),
      },
    });
  }

  //get user employee
  async getUserEmployee(empId: number) {
    if (!empId) throw new BadRequestException('Employee ID is required.');

    const employee = await this.prisma.employee.findUnique({
      where: {
        ID: empId,
      },
      select: {
        FIRSTNAME: true,
        LASTNAME: true,
        MIDDLENAME: true,
        SUFFIX: true,
      },
    });

    if (!employee) throw new NotFoundException('Employee not found.');

    const userProfiles = await this.prisma.users.findMany({
      where: {
        emp_id: empId,
      },
    });

    //exclude password and employee id
    const sanitizedProfile = userProfiles.map(
      ({ password, emp_id, ...rest }) => rest,
    );

    return {
      employee,
      userProfiles: sanitizedProfile,
    };
  }
}
