import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<number[]>(
      'role',
      context.getHandler(),
    ); //returns an array and input base on role guard at controllers

    if (!requiredRoles) return true; // no roles, free access

    //get user from request (Req) set by jwt guard
    const req = context.switchToHttp().getRequest();

    if (!req.user) {
      throw new UnauthorizedException('User not attached to request');
    }

    if (typeof req.user.role === 'undefined')
      throw new ForbiddenException('User has no role assigned.');

    // allow user if match in roles
    return requiredRoles.includes(req.user.role);
  }
}
