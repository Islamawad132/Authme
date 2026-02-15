import {
  Controller,
  Get,
  Post,
  Render,
  UseGuards,
  Query,
  Body,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { Realm } from '@prisma/client';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { LoginService } from './login.service.js';
import { OAuthService } from '../oauth/oauth.service.js';

@ApiExcludeController()
@Controller('realms/:realmName')
@UseGuards(RealmGuard)
@Public()
export class LoginController {
  constructor(
    private readonly loginService: LoginService,
    private readonly oauthService: OAuthService,
  ) {}

  @Get('login')
  @Render('login')
  showLoginForm(
    @CurrentRealm() realm: Realm,
    @Query() query: Record<string, string>,
  ) {
    return {
      layout: 'layouts/main',
      pageTitle: 'Sign In',
      realmName: realm.name,
      realmDisplayName: realm.displayName ?? realm.name,
      client_id: query['client_id'] ?? '',
      redirect_uri: query['redirect_uri'] ?? '',
      response_type: query['response_type'] ?? '',
      scope: query['scope'] ?? '',
      state: query['state'] ?? '',
      nonce: query['nonce'] ?? '',
      code_challenge: query['code_challenge'] ?? '',
      code_challenge_method: query['code_challenge_method'] ?? '',
      error: query['error'] ?? '',
    };
  }

  @Post('login')
  async handleLogin(
    @CurrentRealm() realm: Realm,
    @Body() body: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const user = await this.loginService.validateCredentials(
        realm,
        body['username'],
        body['password'],
      );

      // Create browser login session
      const sessionToken = await this.loginService.createLoginSession(
        realm,
        user,
        req.ip,
        req.headers['user-agent'],
      );

      res.cookie('AUTHME_SESSION', sessionToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: body['rememberMe'] ? 30 * 24 * 60 * 60 * 1000 : undefined,
        path: `/realms/${realm.name}`,
      });

      // Complete the OAuth flow: generate auth code and redirect
      const result = await this.oauthService.authorizeWithUser(realm, user, {
        response_type: body['response_type'],
        client_id: body['client_id'],
        redirect_uri: body['redirect_uri'],
        scope: body['scope'],
        state: body['state'],
        nonce: body['nonce'],
        code_challenge: body['code_challenge'],
        code_challenge_method: body['code_challenge_method'],
      });

      res.redirect(302, result.redirectUrl);
    } catch {
      // Re-render login page with error
      const params = new URLSearchParams();
      params.set('error', 'Invalid username or password');
      if (body['client_id']) params.set('client_id', body['client_id']);
      if (body['redirect_uri']) params.set('redirect_uri', body['redirect_uri']);
      if (body['response_type']) params.set('response_type', body['response_type']);
      if (body['scope']) params.set('scope', body['scope']);
      if (body['state']) params.set('state', body['state']);
      if (body['nonce']) params.set('nonce', body['nonce']);
      if (body['code_challenge']) params.set('code_challenge', body['code_challenge']);
      if (body['code_challenge_method']) params.set('code_challenge_method', body['code_challenge_method']);

      res.redirect(`/realms/${realm.name}/login?${params.toString()}`);
    }
  }
}
