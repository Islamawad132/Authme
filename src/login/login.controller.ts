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
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { Realm } from '@prisma/client';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { LoginService } from './login.service.js';
import { OAuthService } from '../oauth/oauth.service.js';
import { ConsentService } from '../consent/consent.service.js';
import { VerificationService } from '../verification/verification.service.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: 'Verify your identity',
  profile: 'Access your profile information (name, username)',
  email: 'Access your email address',
  roles: 'Access your role assignments',
};

@ApiExcludeController()
@Controller('realms/:realmName')
@UseGuards(RealmGuard)
@Public()
export class LoginController {
  constructor(
    private readonly loginService: LoginService,
    private readonly oauthService: OAuthService,
    private readonly consentService: ConsentService,
    private readonly verificationService: VerificationService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
  ) {}

  // ─── LOGIN ──────────────────────────────────────────────

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
      info: query['info'] ?? '',
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

      // If no OAuth client_id, redirect to account portal
      if (!body['client_id']) {
        return res.redirect(302, `/realms/${realm.name}/account`);
      }

      // Check if client requires consent before completing OAuth flow
      const oauthParams = {
        response_type: body['response_type'],
        client_id: body['client_id'],
        redirect_uri: body['redirect_uri'],
        scope: body['scope'],
        state: body['state'],
        nonce: body['nonce'],
        code_challenge: body['code_challenge'],
        code_challenge_method: body['code_challenge_method'],
      };

      const client = await this.oauthService.validateAuthRequest(realm, oauthParams as any);

      if (client.requireConsent) {
        const scopes = (body['scope'] ?? 'openid').split(' ').filter(Boolean);
        const hasConsent = await this.consentService.hasConsent(user.id, client.id, scopes);

        if (!hasConsent) {
          const reqId = this.consentService.storeConsentRequest({
            userId: user.id,
            clientId: client.id,
            clientName: client.name ?? client.clientId,
            realmName: realm.name,
            scopes,
            oauthParams,
          });
          return res.redirect(302, `/realms/${realm.name}/consent?req=${reqId}`);
        }
      }

      // Complete the OAuth flow: generate auth code and redirect
      const result = await this.oauthService.authorizeWithUser(realm, user, oauthParams as any);
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

  // ─── CONSENT ────────────────────────────────────────────

  @Get('consent')
  @Render('consent')
  showConsentForm(
    @CurrentRealm() realm: Realm,
    @Query('req') reqId: string,
  ) {
    if (!reqId) {
      throw new BadRequestException('Missing consent request ID');
    }

    const consentReq = this.consentService.getConsentRequest(reqId);
    if (!consentReq) {
      throw new BadRequestException('Consent request expired or invalid');
    }

    const newReqId = this.consentService.storeConsentRequest(consentReq);

    const scopeDescriptions = consentReq.scopes.map(
      (s) => SCOPE_DESCRIPTIONS[s] ?? s,
    );

    return {
      layout: 'layouts/main',
      pageTitle: 'Grant Access',
      realmName: realm.name,
      realmDisplayName: realm.displayName ?? realm.name,
      clientName: consentReq.clientName,
      scopes: scopeDescriptions,
      authReqId: newReqId,
    };
  }

  @Post('consent')
  async handleConsent(
    @CurrentRealm() realm: Realm,
    @Body() body: Record<string, string>,
    @Res() res: Response,
  ) {
    const reqId = body['auth_req_id'];
    if (!reqId) {
      throw new BadRequestException('Missing consent request ID');
    }

    const consentReq = this.consentService.getConsentRequest(reqId);
    if (!consentReq) {
      throw new BadRequestException('Consent request expired or invalid');
    }

    if (body['action'] === 'deny') {
      const redirectUri = new URL(consentReq.oauthParams['redirect_uri']);
      redirectUri.searchParams.set('error', 'access_denied');
      redirectUri.searchParams.set('error_description', 'User denied the consent request');
      if (consentReq.oauthParams['state']) {
        redirectUri.searchParams.set('state', consentReq.oauthParams['state']);
      }
      return res.redirect(302, redirectUri.toString());
    }

    await this.consentService.grantConsent(
      consentReq.userId,
      consentReq.clientId,
      consentReq.scopes,
    );

    const user = await this.loginService.findUserById(consentReq.userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const result = await this.oauthService.authorizeWithUser(
      realm,
      user,
      consentReq.oauthParams as any,
    );

    res.redirect(302, result.redirectUrl);
  }

  // ─── EMAIL VERIFICATION ─────────────────────────────────

  @Get('verify-email')
  @Render('verify-email')
  async verifyEmail(
    @CurrentRealm() realm: Realm,
    @Query('token') token: string,
  ) {
    const base = {
      layout: 'layouts/main',
      pageTitle: 'Email Verification',
      realmName: realm.name,
      realmDisplayName: realm.displayName ?? realm.name,
    };

    if (!token) {
      return { ...base, success: false, error: 'Missing verification token.' };
    }

    const result = await this.verificationService.validateToken(token, 'email_verification');
    if (!result) {
      return { ...base, success: false, error: 'This verification link is invalid or has expired.' };
    }

    await this.prisma.user.update({
      where: { id: result.userId },
      data: { emailVerified: true },
    });

    return { ...base, success: true };
  }

  // ─── FORGOT / RESET PASSWORD ────────────────────────────

  @Get('forgot-password')
  @Render('forgot-password')
  showForgotPasswordForm(
    @CurrentRealm() realm: Realm,
    @Query() query: Record<string, string>,
  ) {
    return {
      layout: 'layouts/main',
      pageTitle: 'Forgot Password',
      realmName: realm.name,
      realmDisplayName: realm.displayName ?? realm.name,
      info: query['info'] ?? '',
      error: query['error'] ?? '',
    };
  }

  @Post('forgot-password')
  async handleForgotPassword(
    @CurrentRealm() realm: Realm,
    @Body('email') email: string,
    @Res() res: Response,
  ) {
    const successMessage = encodeURIComponent(
      'If an account with that email exists, we sent a password reset link.',
    );

    if (email) {
      const user = await this.prisma.user.findUnique({
        where: { realmId_email: { realmId: realm.id, email } },
      });

      if (user) {
        const rawToken = await this.verificationService.createToken(
          user.id,
          'password_reset',
          3600,
        );
        const baseUrl = this.config.get<string>('BASE_URL', 'http://localhost:3000');
        const resetUrl = `${baseUrl}/realms/${realm.name}/reset-password?token=${rawToken}`;

        await this.emailService.sendEmail(
          realm.name,
          email,
          'Reset Your Password — AuthMe',
          `<h2>Reset Your Password</h2>
          <p>Click the link below to reset your password. This link expires in 1 hour.</p>
          <p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a></p>
          <p style="color:#6b7280;font-size:0.875rem;">If you didn't request this, you can safely ignore this email.</p>`,
        );
      }
    }

    res.redirect(`/realms/${realm.name}/forgot-password?info=${successMessage}`);
  }

  @Get('reset-password')
  @Render('reset-password')
  async showResetPasswordForm(
    @CurrentRealm() realm: Realm,
    @Query('token') token: string,
    @Query('error') error: string,
  ) {
    const base = {
      layout: 'layouts/main',
      pageTitle: 'Reset Password',
      realmName: realm.name,
      realmDisplayName: realm.displayName ?? realm.name,
    };

    if (!token) {
      return { ...base, error: 'Missing reset token.', token: '' };
    }

    // Peek: validate token without consuming it
    const tokenHash = this.crypto.sha256(token);
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.type !== 'password_reset' || record.expiresAt < new Date()) {
      return { ...base, error: 'This reset link is invalid or has expired.', token: '' };
    }

    return { ...base, token, error: error ?? '' };
  }

  @Post('reset-password')
  async handleResetPassword(
    @CurrentRealm() realm: Realm,
    @Body() body: Record<string, string>,
    @Res() res: Response,
  ) {
    const token = body['token'];
    const password = body['password'];
    const confirmPassword = body['confirmPassword'];

    if (!token || !password) {
      return res.redirect(
        `/realms/${realm.name}/reset-password?token=${token ?? ''}&error=${encodeURIComponent('Missing required fields.')}`,
      );
    }

    if (password !== confirmPassword) {
      return res.redirect(
        `/realms/${realm.name}/reset-password?token=${token}&error=${encodeURIComponent('Passwords do not match.')}`,
      );
    }

    if (password.length < 8) {
      return res.redirect(
        `/realms/${realm.name}/reset-password?token=${token}&error=${encodeURIComponent('Password must be at least 8 characters.')}`,
      );
    }

    const result = await this.verificationService.validateToken(token, 'password_reset');
    if (!result) {
      return res.redirect(
        `/realms/${realm.name}/reset-password?error=${encodeURIComponent('This reset link is invalid or has expired.')}`,
      );
    }

    const passwordHash = await this.crypto.hashPassword(password);
    await this.prisma.user.update({
      where: { id: result.userId },
      data: { passwordHash },
    });

    const info = encodeURIComponent('Your password has been reset. You can now sign in.');
    res.redirect(`/realms/${realm.name}/login?info=${info}`);
  }
}
