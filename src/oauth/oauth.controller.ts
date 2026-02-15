import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { Realm } from '@prisma/client';
import { OAuthService } from './oauth.service.js';
import { LoginService } from '../login/login.service.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('OAuth')
@Controller('realms/:realmName/protocol/openid-connect')
@UseGuards(RealmGuard)
@Public()
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly loginService: LoginService,
  ) {}

  @Get('auth')
  @ApiOperation({ summary: 'Authorization endpoint (code flow)' })
  async authorize(
    @CurrentRealm() realm: Realm,
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Validate OAuth params (client_id, redirect_uri, etc.) early
    await this.oauthService.validateAuthRequest(realm, query as any);

    // Check for existing SSO session cookie
    const sessionCookie = (req.cookies as Record<string, string>)?.['AUTHME_SESSION'];
    if (sessionCookie) {
      const user = await this.loginService.validateLoginSession(realm, sessionCookie);
      if (user) {
        // SSO: user already logged in, issue code directly
        const result = await this.oauthService.authorizeWithUser(realm, user, query as any);
        return res.redirect(302, result.redirectUrl);
      }
    }

    // No valid session: redirect to login page with OAuth params
    const loginParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) loginParams.set(key, value);
    }
    res.redirect(302, `/realms/${realm.name}/login?${loginParams.toString()}`);
  }
}
