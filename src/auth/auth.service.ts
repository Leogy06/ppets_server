import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { User } from 'src/dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string) {
    const user = await this.userService.findByUsername(username);

    //check if user is active
    if (user && user.is_active === 0)
      throw new UnauthorizedException('This user has been deactivated.');

    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }

    throw new UnauthorizedException('Invalid Credentials');
  }

  async loginWithCredentials(user: User, res: Response) {
    const payload = {
      sub: user.id,
      username: user.username,
      role: String(user.role),
      employeeId: user.emp_id,
      userId: user.id,
    };

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

    return { message: 'Login successful', user: userDto };
  }
  async logout(res: any) {
    res.clearCookie('access_token');
    return { message: 'Logged out successfully' };
  }
}
