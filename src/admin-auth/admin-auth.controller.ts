import { Controller, Post, Get, Body, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { AdminAuthService } from './admin-auth.service.js';

@ApiTags('Admin Auth')
@Controller('admin/auth')
@ApiSecurity('admin-api-key')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Admin login' })
  async login(@Body() body: { username: string; password: string }) {
    return this.adminAuthService.login(body.username, body.password);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current admin user info' })
  async getMe(@Req() req: Request) {
    const adminUser = (req as any)['adminUser'];
    if (!adminUser) {
      throw new UnauthorizedException('Not authenticated');
    }
    return adminUser;
  }
}
