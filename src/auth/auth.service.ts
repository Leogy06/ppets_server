import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { User } from 'src/dto';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly prisma: DatabaseService,
  ) {}

  async validateUser(username: string, pass: string) {
    const user = await this.userService.findByUsername(username);

    //check if user is active
    if (user && user.is_active === 0)
      throw new UnauthorizedException('This user has been deactivated.');

    //sucess
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }

    throw new BadRequestException('Invalid Credentials');
  }

  async loginWithCredentials(user: User, res: Response) {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      employeeId: user.emp_id,
      userId: user.id,
    };

    //find employee
    const employee = await this.prisma.employees.findUnique({
      where: {
        ID: payload.employeeId,
      },
      select: {
        FIRSTNAME: true,
        LASTNAME: true,
        MIDDLENAME: true,
        SUFFIX: true,
        CURRENT_DPT_ID: true,
      },
    });

    const token = this.jwtService.sign(payload);

    // ✅ Set cookie (works fine with passthrough)
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    const userDto = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    return { message: 'Login successful', user: userDto, employee };
  }
  async logout(res: any) {
    res.clearCookie('access_token');
    return { message: 'Logged out successfully' };
  }
}
