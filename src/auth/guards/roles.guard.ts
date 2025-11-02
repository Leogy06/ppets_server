import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<number[]>(
      'roleNumber',
      context.getHandler(),
    );

    if (!requiredRoles) return true; // no roles, free access

    //get user from request (Req) set by jwt guard
    const { user } = context.switchToHttp().getRequest();

    // allow user if match in roles
    return requiredRoles.includes(user.role);
  }
}
