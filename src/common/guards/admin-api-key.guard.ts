import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { AdminAuthService } from '../../admin-auth/admin-auth.service.js';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    private readonly adminAuthService: AdminAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();

    // Only enforce auth on admin routes
    if (!request.path.startsWith('/admin/') && !request.path.startsWith('/admin')) {
      return true;
    }

    // Try Bearer token (admin JWT) first
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const adminUser = await this.adminAuthService.validateAdminToken(token);
        (request as any)['adminUser'] = adminUser;
        return true;
      } catch {
        // Fall through to API key check
      }
    }

    // Fallback: static API key
    const expectedKey = this.configService.get<string>('ADMIN_API_KEY');
    if (expectedKey) {
      const apiKey = request.headers['x-admin-api-key'];
      if (typeof apiKey === 'string' && apiKey === expectedKey) {
        (request as any)['adminUser'] = { userId: 'api-key', roles: ['super-admin'] };
        return true;
      }
    }

    throw new UnauthorizedException('Invalid or missing admin credentials');
  }
}
