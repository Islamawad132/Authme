import { Controller, Post, Get, Body, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { AdminAuthService } from './admin-auth.service.js';
import { resolveClientIp } from '../common/utils/proxy-ip.util.js';

@ApiTags('Admin Auth')
@Controller('admin/auth')
@ApiSecurity('admin-api-key')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Admin login' })
  async login(
    @Body() body: { username: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = resolveClientIp(req);

    const { rateLimitHeaders, ...tokenResponse } = await this.adminAuthService.login(
      body.username,
      body.password,
      ip,
    );

    for (const [name, value] of Object.entries(rateLimitHeaders)) {
      res.setHeader(name, value);
    }

    return tokenResponse;
  }

  @Post('logout')
  @ApiOperation({ summary: 'Admin logout – revoke current token' })
  async logout(@Req() req: Request) {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      this.adminAuthService.revokeToken(authHeader.slice(7));
    }
    return { message: 'Logged out' };
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
