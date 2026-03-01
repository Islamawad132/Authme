import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
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
  @HttpCode(HttpStatus.OK)
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
  @ApiOperation({ summary: 'End session / logout (POST)' })
  logout(
    @CurrentRealm() realm: Realm,
    @Body() body: { refresh_token?: string },
    @Req() req: Request,
  ) {
    return this.tokensService.logout(realm, req.ip, body.refresh_token);
  }

  @Get('logout')
  @ApiOperation({ summary: 'RP-Initiated Logout (GET, OIDC spec)' })
  async logoutGet(
    @CurrentRealm() realm: Realm,
    @Query('id_token_hint') idTokenHint: string | undefined,
    @Query('post_logout_redirect_uri') postLogoutRedirectUri: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.tokensService.logoutByIdToken(realm, req.ip, idTokenHint);

    if (postLogoutRedirectUri) {
      const redirectUrl = new URL(postLogoutRedirectUri);
      if (state) {
        redirectUrl.searchParams.set('state', state);
      }
      res.redirect(redirectUrl.toString());
    } else {
      res.status(HttpStatus.NO_CONTENT).send();
    }
  }

  @Get('userinfo')
  @ApiOperation({ summary: 'Get user info from access token' })
  userinfo(@CurrentRealm() realm: Realm, @Req() req: Request) {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        error: 'invalid_token',
        error_description: 'Missing Bearer token',
      });
    }
    const token = authHeader.slice(7);
    return this.tokensService.userinfo(realm, token);
  }
}
