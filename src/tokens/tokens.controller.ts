import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Realm } from '@prisma/client';
import { TokensService } from './tokens.service.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('Tokens')
@Controller('realms/:realmName/protocol/openid-connect')
@UseGuards(RealmGuard)
@Public()
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Post('token/introspect')
  @ApiOperation({ summary: 'Token introspection (RFC 7662)' })
  introspect(
    @CurrentRealm() realm: Realm,
    @Body() body: { token: string },
  ) {
    return this.tokensService.introspect(realm, body.token);
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Token revocation (RFC 7009)' })
  revoke(
    @CurrentRealm() realm: Realm,
    @Body() body: { token: string; token_type_hint?: string },
  ) {
    return this.tokensService.revoke(realm, body.token, body.token_type_hint);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End session / logout' })
  logout(
    @CurrentRealm() realm: Realm,
    @Body() body: { refresh_token: string },
  ) {
    return this.tokensService.logout(realm, body.refresh_token);
  }

  @Get('userinfo')
  @ApiOperation({ summary: 'Get user info from access token' })
  userinfo(@CurrentRealm() realm: Realm, @Req() req: Request) {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'invalid_token', error_description: 'Missing Bearer token' };
    }
    const token = authHeader.slice(7);
    return this.tokensService.userinfo(realm, token);
  }
}
