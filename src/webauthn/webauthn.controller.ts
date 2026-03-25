import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { Realm } from '@prisma/client';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { WebAuthnService } from './webauthn.service.js';
import { LoginService } from '../login/login.service.js';
import { OAuthService } from '../oauth/oauth.service.js';
import { ConsentService } from '../consent/consent.service.js';
import {
  StartRegistrationDto,
  VerifyRegistrationDto,
  StartAuthenticationDto,
  VerifyAuthenticationDto,
} from './webauthn.dto.js';
import type { AuthorizeParams } from '../oauth/oauth.service.js';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';

@ApiExcludeController()
@Controller('realms/:realmName')
@UseGuards(RealmGuard)
@Public()
export class WebAuthnController {
  constructor(
    private readonly webAuthnService: WebAuthnService,
    private readonly loginService: LoginService,
    private readonly oauthService: OAuthService,
    private readonly consentService: ConsentService,
  ) {}

  private async getSessionUser(realm: Realm, req: Request) {
    const sessionToken = req.cookies?.['AUTHME_SESSION'];
    if (!sessionToken) return null;
    return this.loginService.validateLoginSession(realm, sessionToken);
  }

  // ─── Registration ──────────────────────────────────────────────

  @Post('webauthn/register/options')
  @HttpCode(HttpStatus.OK)
  async startRegistration(
    @CurrentRealm() realm: Realm,
    @Body() body: StartRegistrationDto,
    @Req() req: Request,
  ) {
    const user = await this.getSessionUser(realm, req);
    if (!user) {
      throw new BadRequestException('You must be signed in to register a passkey');
    }

    return this.webAuthnService.generateRegistrationOptions(user, realm);
  }

  @Post('webauthn/register/verify')
  @HttpCode(HttpStatus.OK)
  async completeRegistration(
    @CurrentRealm() realm: Realm,
    @Body() body: VerifyRegistrationDto,
    @Req() req: Request,
  ) {
    const user = await this.getSessionUser(realm, req);
    if (!user) {
      throw new BadRequestException('You must be signed in to register a passkey');
    }

    const credential = await this.webAuthnService.verifyRegistration(
      user,
      realm,
      body.response as RegistrationResponseJSON,
      body.friendlyName,
    );

    return {
      id: credential.id,
      credentialId: credential.credentialId,
      friendlyName: credential.friendlyName,
      deviceType: credential.deviceType,
      createdAt: credential.createdAt,
    };
  }

  // ─── Authentication ────────────────────────────────────────────

  @Post('webauthn/authenticate/options')
  @HttpCode(HttpStatus.OK)
  async startAuthentication(
    @CurrentRealm() realm: Realm,
    @Body() body: StartAuthenticationDto,
    @Req() req: Request,
  ) {
    // Look up userId if username given (for autofill / non-resident-key flow)
    let userId: string | undefined;
    if (body.username) {
      const user = await this.loginService.findUserByUsername(realm, body.username);
      userId = user?.id;
    }

    return this.webAuthnService.generateAuthenticationOptions(realm, userId);
  }

  @Post('webauthn/authenticate/verify')
  @HttpCode(HttpStatus.OK)
  async completeAuthentication(
    @CurrentRealm() realm: Realm,
    @Body() body: VerifyAuthenticationDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { user } = await this.webAuthnService.verifyAuthentication(
      realm,
      body.response as AuthenticationResponseJSON,
    );

    // Build OAuth params from request body
    const oauthParams: Record<string, string> = {};
    const bodyAsRecord = body as unknown as Record<string, unknown>;
    for (const key of ['response_type', 'client_id', 'redirect_uri', 'scope', 'state', 'nonce', 'code_challenge', 'code_challenge_method']) {
      const val = bodyAsRecord[key];
      if (typeof val === 'string' && val) oauthParams[key] = val;
    }

    // Create session (invalidating any pre-existing cookie to prevent session fixation)
    const sessionToken = await this.loginService.createLoginSession(
      realm,
      user,
      req.ip,
      req.headers['user-agent'],
      req.cookies?.['AUTHME_SESSION'] as string | undefined,
    );

    res.cookie('AUTHME_SESSION', sessionToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: `/realms/${realm.name}`,
    });

    // Determine redirect
    if (!oauthParams['client_id']) {
      return res.json({ redirectUrl: `/realms/${realm.name}/account` });
    }

    try {
      const client = await this.oauthService.validateAuthRequest(realm, oauthParams as unknown as AuthorizeParams);

      if (client.requireConsent) {
        const scopes = (oauthParams['scope'] ?? 'openid').split(' ').filter(Boolean);
        const hasConsent = await this.consentService.hasConsent(user.id, client.id, scopes);

        if (!hasConsent) {
          const reqId = await this.consentService.storeConsentRequest({
            userId: user.id,
            clientId: client.id,
            clientName: client.name ?? client.clientId,
            realmName: realm.name,
            scopes,
            oauthParams,
          });
          return res.json({ redirectUrl: `/realms/${realm.name}/consent?req=${reqId}` });
        }
      }

      const result = await this.oauthService.authorizeWithUser(realm, user, oauthParams as unknown as AuthorizeParams);
      return res.json({ redirectUrl: result.redirectUrl });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.json({ redirectUrl: `/realms/${realm.name}/login?error=${encodeURIComponent(message)}` });
    }
  }

  // ─── Account — Credential Management ──────────────────────────

  @Get('account/webauthn/credentials')
  async listCredentials(
    @CurrentRealm() realm: Realm,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = await this.getSessionUser(realm, req);
    if (!user) {
      return res.redirect(`/realms/${realm.name}/login`);
    }

    const credentials = await this.webAuthnService.getUserCredentials(user.id);
    return res.json(
      credentials.map((c) => ({
        id: c.id,
        friendlyName: c.friendlyName,
        deviceType: c.deviceType,
        backedUp: c.backedUp,
        transports: c.transports,
        createdAt: c.createdAt,
        lastUsedAt: c.lastUsedAt,
      })),
    );
  }

  @Delete('account/webauthn/credentials/:credentialId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCredential(
    @CurrentRealm() realm: Realm,
    @Param('credentialId') credentialId: string,
    @Req() req: Request,
  ) {
    const user = await this.getSessionUser(realm, req);
    if (!user) {
      throw new BadRequestException('You must be signed in to remove a passkey');
    }

    await this.webAuthnService.removeCredential(user.id, credentialId);
  }
}
