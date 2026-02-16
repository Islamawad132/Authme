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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { Realm } from '@prisma/client';
import { DeviceService } from './device.service.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';

@ApiTags('Device Authorization')
@Controller('realms/:realmName')
@UseGuards(RealmGuard)
@Public()
export class DeviceController {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  @Post('protocol/openid-connect/auth/device')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate device authorization request' })
  async initiateDevice(
    @CurrentRealm() realm: Realm,
    @Body() body: { client_id: string; scope?: string },
  ) {
    return this.deviceService.initiateDeviceAuth(realm, body.client_id, body.scope);
  }

  @Get('device')
  @ApiOperation({ summary: 'Device verification page' })
  async devicePage(
    @CurrentRealm() realm: Realm,
    @Query('user_code') userCode: string,
    @Res() res: Response,
  ) {
    return res.render('device', {
      pageTitle: 'Device Authorization',
      realmName: realm.name,
      realmDisplayName: realm.displayName ?? realm.name,
      userCode: userCode ?? '',
    });
  }

  @Post('device')
  @ApiOperation({ summary: 'Approve or deny device authorization' })
  async handleDevice(
    @CurrentRealm() realm: Realm,
    @Body() body: { user_code: string; action: 'approve' | 'deny'; username?: string; password?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const renderCtx = {
      pageTitle: 'Device Authorization',
      realmName: realm.name,
      realmDisplayName: realm.displayName ?? realm.name,
    };

    // Authenticate user if approving
    if (body.action === 'approve') {
      if (!body.username || !body.password) {
        return res.render('device', {
          ...renderCtx,
          userCode: body.user_code,
          error: 'Username and password are required',
        });
      }

      const user = await this.prisma.user.findUnique({
        where: { realmId_username: { realmId: realm.id, username: body.username } },
      });

      if (!user || !user.passwordHash) {
        return res.render('device', {
          ...renderCtx,
          userCode: body.user_code,
          error: 'Invalid credentials',
        });
      }

      const valid = await this.crypto.verifyPassword(user.passwordHash, body.password);
      if (!valid) {
        return res.render('device', {
          ...renderCtx,
          userCode: body.user_code,
          error: 'Invalid credentials',
        });
      }

      await this.deviceService.approveDevice(realm, body.user_code, user.id);
      return res.render('device-success', {
        ...renderCtx,
        message: 'Device authorized successfully. You can close this page.',
      });
    }

    // Deny
    await this.deviceService.denyDevice(realm, body.user_code);
    return res.render('device-success', {
      ...renderCtx,
      message: 'Device authorization denied.',
    });
  }
}
