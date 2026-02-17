import {
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

    //check if email already exist
    const [isEmailExist, isUsernameExist, isEmployee] = await Promise.all([
      await this.prisma.users.findFirst({
        where: {
          email: createUserDto.email,
        },
      }),
      await this.prisma.users.findFirst({
        where: {
          username: createUserDto.username,
        },
      }),
      await this.prisma.employees.findUnique({
        where: {
          ID: createUserDto.emp_id,
        },
      }),
    ]);

    if (isEmailExist) throw new BadRequestException('Email already exist.');
    if (isUsernameExist)
      throw new BadRequestException('Username already exist.');

    if (!isEmployee)
      throw new BadRequestException('Register user is not employee.');

    //creating user
    return await this.prisma.users.create({
      data: {
        ...createUserDto,
        password: bcrypt.hashSync(createUserDto.password, 10),
      },
    });
  }

  //get user employee
  //
  async getUserEmployee(empId: number) {
    if (!empId) throw new BadRequestException('Employee ID is required.');

    const employee = await this.prisma.employees.findUnique({
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

  //update user active status
  async updateUserActiveStatus(userId: number, status: number) {
    //check if status value is VALID
    if (![0, 1].includes(status))
      throw new BadRequestException('Invalid active status value');

    //check if user exist
    const user = await this.prisma.users.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) throw new NotFoundException('User not found.');

    return await this.prisma.users.update({
      where: {
        id: userId,
      },
      data: {
        is_active: status,
      },
    });
  }

  async adminCreateUser(empId: number, role: number) {
    const employee = await this.prisma.employees.findUnique({
      where: {
        ID: empId,
      },
    });

    if (!employee) throw new NotFoundException("Employee doesn't exist.");

    //lets checkl if user has account already

    const isEmployeeUser = await this.prisma.users.findFirst({
      where: {
        emp_id: empId,
        // role, remove role, every employee should only have one account
      },
    });

    if (isEmployeeUser)
      throw new BadRequestException('Employee already have an account.');

    //hash paspassword
    const hashedPassword = bcrypt.hashSync(employee.ID_NUMBER?.toString(), 10);

    //username
    let username: string;
    if (role === 1) {
      username = `${employee.ID_NUMBER}_admin`.trim();
    } else if (role === 2) {
      username = `${employee.ID_NUMBER}_employee`.trim();
    } else {
      throw new BadRequestException('Role value is invalid.');
    }

    return this.prisma.users.create({
      data: {
        username,
        password: hashedPassword,
        role,
        emp_id: empId,
      },
    });
  }
}
