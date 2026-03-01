import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ADMIN_ROLES_KEY = 'adminRoles';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<string[]>(ADMIN_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowed?.length) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!user?.role) throw new ForbiddenException('Forbidden');
    if (allowed.includes('admin') && user.role === 'admin') return true;
    if (allowed.includes('seller') && (user.role === 'seller' || user.role === 'admin')) return true;
    throw new ForbiddenException('Forbidden');
  }
}
