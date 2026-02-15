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

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();

    // Only enforce API key on admin routes
    if (!request.path.startsWith('/admin/') && !request.path.startsWith('/admin')) {
      return true;
    }

    const expectedKey = this.configService.get<string>('ADMIN_API_KEY');

    if (!expectedKey) {
      throw new UnauthorizedException('ADMIN_API_KEY is not configured');
    }

    const apiKey = request.headers['x-admin-api-key'];
    if (typeof apiKey === 'string' && apiKey === expectedKey) {
      return true;
    }

    throw new UnauthorizedException('Invalid or missing admin API key');
  }
}
