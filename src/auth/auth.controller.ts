import {
  Controller,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Realm } from '@prisma/client';
import { AuthService } from './auth.service.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('Authentication')
@Controller('realms/:realmName/protocol/openid-connect')
@UseGuards(RealmGuard)
@Public()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('token')
  @ApiOperation({ summary: 'Token endpoint (password, client_credentials, refresh_token, authorization_code)' })
  @ApiConsumes('application/x-www-form-urlencoded', 'application/json')
  token(
    @CurrentRealm() realm: Realm,
    @Body() body: Record<string, string>,
    @Req() req: Request,
  ) {
    return this.authService.handleTokenRequest(
      realm,
      body,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
