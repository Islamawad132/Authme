import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { Realm } from '@prisma/client';
import { DeviceService } from './device.service.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { BruteForceService } from '../brute-force/brute-force.service.js';
import { ThemeRenderService } from '../theme/theme-render.service.js';

@ApiTags('Device Authorization')
@Controller('realms/:realmName')
@UseGuards(RealmGuard)
@Public()
export class DeviceController {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly bruteForce: BruteForceService,
    private readonly themeRender: ThemeRenderService,
  ) {}

  @Post('protocol/openid-connect/auth/device')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate device authorization request' })
  @ApiResponse({ status: 200, description: 'Device authorization response with device_code and user_code' })
  @ApiResponse({ status: 400, description: 'invalid_client — unknown or disabled client' })
  async initiateDevice(
    @CurrentRealm() realm: Realm,
    @Body() body: { client_id: string; scope?: string },
  ) {
    return this.deviceService.initiateDeviceAuth(realm, body.client_id, body.scope);
  }

  @Get('device')
  @ApiOperation({ summary: 'Device verification page' })
  @ApiResponse({ status: 200, description: 'HTML page for user to enter/confirm device code' })
  @ApiResponse({ status: 400, description: 'Realm not found' })
  async devicePage(
    @CurrentRealm() realm: Realm,
    @Query('user_code') userCode: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.themeRender.render(res, realm, 'login', 'device', {
      pageTitle: 'Device Authorization',
      userCode: userCode ?? '',
    }, req);
  }

  @Post('device')
  @ApiOperation({ summary: 'Approve or deny device authorization' })
  @ApiResponse({ status: 200, description: 'Device approved or denied; returns confirmation HTML page' })
  @ApiResponse({ status: 400, description: 'Bad request — missing user_code, credentials, or invalid code' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or account locked' })
  async handleDevice(
    @CurrentRealm() realm: Realm,
    @Body() body: { user_code: string; action: 'approve' | 'deny'; username?: string; password?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Authenticate user if approving
    if (body.action === 'approve') {
      if (!body.username || !body.password) {
        return this.themeRender.render(res, realm, 'login', 'device', {
          pageTitle: 'Device Authorization',
          userCode: body.user_code,
          error: 'Username and password are required',
        }, req);
      }

      const user = await this.prisma.user.findUnique({
        where: { realmId_username: { realmId: realm.id, username: body.username } },
      });

      if (!user || !user.passwordHash) {
        return this.themeRender.render(res, realm, 'login', 'device', {
          pageTitle: 'Device Authorization',
          userCode: body.user_code,
          error: 'Invalid credentials',
        }, req);
      }

      // Check brute-force lockout before attempting password verification
      const lockStatus = this.bruteForce.checkLocked(realm, user);
      if (lockStatus.locked) {
        return this.themeRender.render(res, realm, 'login', 'device', {
          pageTitle: 'Device Authorization',
          userCode: body.user_code,
          error: 'Account is temporarily locked due to too many failed attempts. Please try again later.',
        }, req);
      }

      const valid = await this.crypto.verifyPassword(user.passwordHash, body.password);
      if (!valid) {
        await this.bruteForce.recordFailure(realm, user.id, req.ip);
        return this.themeRender.render(res, realm, 'login', 'device', {
          pageTitle: 'Device Authorization',
          userCode: body.user_code,
          error: 'Invalid credentials',
        }, req);
      }

      // Successful authentication — reset failure counter
      await this.bruteForce.resetFailures(realm.id, user.id);

      await this.deviceService.approveDevice(realm, body.user_code, user.id);
      return this.themeRender.render(res, realm, 'login', 'device-success', {
        pageTitle: 'Device Authorization',
        message: 'Device authorized successfully. You can close this page.',
      }, req);
    }

    // Deny
    await this.deviceService.denyDevice(realm, body.user_code);
    this.themeRender.render(res, realm, 'login', 'device-success', {
      pageTitle: 'Device Authorization',
      message: 'Device authorization denied.',
    }, req);
  }
}
