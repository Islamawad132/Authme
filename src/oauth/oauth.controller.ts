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
import { ConsentService } from '../consent/consent.service.js';
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
    private readonly consentService: ConsentService,
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
    const client = await this.oauthService.validateAuthRequest(realm, query as any);

    // Check for existing SSO session cookie
    const sessionCookie = (req.cookies as Record<string, string>)?.['AUTHME_SESSION'];
    if (sessionCookie) {
      const user = await this.loginService.validateLoginSession(realm, sessionCookie);
      if (user) {
        // Check if client requires consent
        if (client.requireConsent) {
          const scopes = (query['scope'] ?? 'openid').split(' ').filter(Boolean);
          const hasConsent = await this.consentService.hasConsent(user.id, client.id, scopes);

          if (!hasConsent) {
            const reqId = this.consentService.storeConsentRequest({
              userId: user.id,
              clientId: client.id,
              clientName: client.name ?? client.clientId,
              realmName: realm.name,
              scopes,
              oauthParams: query,
            });
            return res.redirect(302, `/realms/${realm.name}/consent?req=${reqId}`);
          }
        }

        // SSO: user already logged in and consent is granted, issue code directly
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
