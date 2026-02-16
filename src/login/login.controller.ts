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
import { PasswordPolicyService } from '../password-policy/password-policy.service.js';
import { MfaService } from '../mfa/mfa.service.js';

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
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly mfaService: MfaService,
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
        req.ip,
      );

      // Build OAuth params for later use
      const oauthParams: Record<string, string> = {};
      for (const key of ['response_type', 'client_id', 'redirect_uri', 'scope', 'state', 'nonce', 'code_challenge', 'code_challenge_method']) {
        if (body[key]) oauthParams[key] = body[key];
      }

      // Check password expiry
      if (this.passwordPolicyService.isExpired(user, realm)) {
        const changeToken = this.crypto.generateSecret(32);
        // Store a short-lived verification token for the change-password flow
        await this.verificationService.createTokenWithHash(
          user.id,
          'change_password',
          300,
          this.crypto.sha256(changeToken),
        );

        return res.redirect(
          `/realms/${realm.name}/change-password?token=${changeToken}&info=${encodeURIComponent('Your password has expired and must be changed.')}`,
        );
      }

      // Check MFA
      const mfaRequired = await this.mfaService.isMfaRequired(realm, user.id);
      const mfaEnabled = await this.mfaService.isMfaEnabled(user.id);

      if (mfaEnabled) {
        // User has TOTP set up — require verification
        const challengeToken = this.mfaService.createMfaChallenge(
          user.id,
          realm.id,
          oauthParams,
        );

        res.cookie('AUTHME_MFA_CHALLENGE', challengeToken, {
          httpOnly: true,
          secure: process.env['NODE_ENV'] === 'production',
          sameSite: 'lax',
          maxAge: 5 * 60 * 1000,
          path: `/realms/${realm.name}`,
        });

        return res.redirect(`/realms/${realm.name}/totp`);
      }

      if (mfaRequired && !mfaEnabled) {
        // Realm requires MFA but user hasn't set it up yet
        // Create session first so they can set up TOTP
        const sessionToken = await this.loginService.createLoginSession(
          realm, user, req.ip, req.headers['user-agent'],
        );

        res.cookie('AUTHME_SESSION', sessionToken, {
          httpOnly: true,
          secure: process.env['NODE_ENV'] === 'production',
          sameSite: 'lax',
          path: `/realms/${realm.name}`,
        });

        return res.redirect(`/realms/${realm.name}/account/totp-setup?info=${encodeURIComponent('Two-factor authentication is required. Please set it up now.')}`);
      }

      // No MFA needed — proceed to create session
      return await this.completeLogin(realm, user, body, oauthParams, req, res);
    } catch (err: any) {
      const params = new URLSearchParams();
      params.set('error', err.message ?? 'Invalid username or password');
      for (const key of ['client_id', 'redirect_uri', 'response_type', 'scope', 'state', 'nonce', 'code_challenge', 'code_challenge_method']) {
        if (body[key]) params.set(key, body[key]);
      }
      res.redirect(`/realms/${realm.name}/login?${params.toString()}`);
    }
  }

  private async completeLogin(
    realm: Realm,
    user: any,
    body: Record<string, string>,
    oauthParams: Record<string, string>,
    req: Request,
    res: Response,
  ) {
    const sessionToken = await this.loginService.createLoginSession(
      realm, user, req.ip, req.headers['user-agent'],
    );

    res.cookie('AUTHME_SESSION', sessionToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: body['rememberMe'] ? 30 * 24 * 60 * 60 * 1000 : undefined,
      path: `/realms/${realm.name}`,
    });

    if (!oauthParams['client_id']) {
      return res.redirect(302, `/realms/${realm.name}/account`);
    }

    const client = await this.oauthService.validateAuthRequest(realm, oauthParams as any);

    if (client.requireConsent) {
      const scopes = (oauthParams['scope'] ?? 'openid').split(' ').filter(Boolean);
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

    const result = await this.oauthService.authorizeWithUser(realm, user, oauthParams as any);
    res.redirect(302, result.redirectUrl);
  }

  // ─── MFA / TOTP ───────────────────────────────────────────

  @Get('totp')
  @Render('totp')
  showTotpForm(
    @CurrentRealm() realm: Realm,
    @Query('error') error: string,
  ) {
    return {
      layout: 'layouts/main',
      pageTitle: 'Two-Factor Authentication',
      realmName: realm.name,
      realmDisplayName: realm.displayName ?? realm.name,
      error: error ?? '',
    };
  }

  @Post('totp')
  async handleTotp(
    @CurrentRealm() realm: Realm,
    @Body() body: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const challengeToken = req.cookies?.['AUTHME_MFA_CHALLENGE'];
    if (!challengeToken) {
      return res.redirect(`/realms/${realm.name}/login?error=${encodeURIComponent('MFA session expired. Please login again.')}`);
    }

    const challenge = this.mfaService.validateMfaChallenge(challengeToken);
    if (!challenge) {
      return res.redirect(`/realms/${realm.name}/login?error=${encodeURIComponent('MFA session expired. Please login again.')}`);
    }

    // Clear the MFA challenge cookie
    res.clearCookie('AUTHME_MFA_CHALLENGE', { path: `/realms/${realm.name}` });

    const code = body['code'];
    const recoveryCode = body['recoveryCode'];

    let verified = false;
    if (code) {
      verified = await this.mfaService.verifyTotp(challenge.userId, code);
    } else if (recoveryCode) {
      verified = await this.mfaService.verifyRecoveryCode(challenge.userId, recoveryCode);
    }

    if (!verified) {
      // Re-create challenge for retry
      const newToken = this.mfaService.createMfaChallenge(
        challenge.userId,
        challenge.realmId,
        challenge.oauthParams,
      );
      res.cookie('AUTHME_MFA_CHALLENGE', newToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 5 * 60 * 1000,
        path: `/realms/${realm.name}`,
      });
      return res.redirect(`/realms/${realm.name}/totp?error=${encodeURIComponent('Invalid code. Please try again.')}`);
    }

    // MFA verified — complete login
    const user = await this.loginService.findUserById(challenge.userId);
    if (!user) {
      return res.redirect(`/realms/${realm.name}/login?error=${encodeURIComponent('User not found.')}`);
    }

    return await this.completeLogin(realm, user, body, challenge.oauthParams ?? {}, req, res);
  }

  // ─── CHANGE PASSWORD (forced) ─────────────────────────────

  @Get('change-password')
  @Render('change-password')
  showChangePasswordForm(
    @CurrentRealm() realm: Realm,
    @Query() query: Record<string, string>,
  ) {
    const policyHints: string[] = [];
    if (realm.passwordMinLength > 1) policyHints.push(`At least ${realm.passwordMinLength} characters`);
    if (realm.passwordRequireUppercase) policyHints.push('At least one uppercase letter');
    if (realm.passwordRequireLowercase) policyHints.push('At least one lowercase letter');
    if (realm.passwordRequireDigits) policyHints.push('At least one digit');
    if (realm.passwordRequireSpecialChars) policyHints.push('At least one special character');

    return {
      layout: 'layouts/main',
      pageTitle: 'Change Password',
      realmName: realm.name,
      realmDisplayName: realm.displayName ?? realm.name,
      token: query['token'] ?? '',
      error: query['error'] ?? '',
      info: query['info'] ?? '',
      policyHints: policyHints.length > 0 ? policyHints : null,
    };
  }

  @Post('change-password')
  async handleChangePassword(
    @CurrentRealm() realm: Realm,
    @Body() body: Record<string, string>,
    @Res() res: Response,
  ) {
    const token = body['token'];
    const currentPassword = body['currentPassword'];
    const newPassword = body['newPassword'];
    const confirmPassword = body['confirmPassword'];

    const redirectBase = `/realms/${realm.name}/change-password?token=${token ?? ''}`;

    if (!token || !currentPassword || !newPassword) {
      return res.redirect(`${redirectBase}&error=${encodeURIComponent('All fields are required.')}`);
    }

    if (newPassword !== confirmPassword) {
      return res.redirect(`${redirectBase}&error=${encodeURIComponent('New passwords do not match.')}`);
    }

    // Validate token
    const tokenHash = this.crypto.sha256(token);
    const record = await this.prisma.verificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.type !== 'change_password' || record.expiresAt < new Date()) {
      return res.redirect(`/realms/${realm.name}/login?error=${encodeURIComponent('Change password session expired. Please login again.')}`);
    }

    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || !user.passwordHash) {
      return res.redirect(`/realms/${realm.name}/login?error=${encodeURIComponent('User not found.')}`);
    }

    // Verify current password
    const valid = await this.crypto.verifyPassword(user.passwordHash, currentPassword);
    if (!valid) {
      return res.redirect(`${redirectBase}&error=${encodeURIComponent('Current password is incorrect.')}`);
    }

    // Validate new password against policy
    const validation = this.passwordPolicyService.validate(realm, newPassword);
    if (!validation.valid) {
      return res.redirect(`${redirectBase}&error=${encodeURIComponent(validation.errors.join('. '))}`);
    }

    // Check password history
    if (realm.passwordHistoryCount > 0) {
      const inHistory = await this.passwordPolicyService.checkHistory(
        user.id, realm.id, newPassword, realm.passwordHistoryCount,
      );
      if (inHistory) {
        return res.redirect(`${redirectBase}&error=${encodeURIComponent('Password was used recently. Choose a different password.')}`);
      }
    }

    // Update password
    const passwordHash = await this.crypto.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });

    // Record history
    await this.passwordPolicyService.recordHistory(
      user.id, realm.id, passwordHash, realm.passwordHistoryCount,
    );

    // Consume the token
    await this.prisma.verificationToken.delete({ where: { id: record.id } });

    const info = encodeURIComponent('Password changed successfully. You can now sign in.');
    res.redirect(`/realms/${realm.name}/login?info=${info}`);
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

    // Validate against password policy
    const validation = this.passwordPolicyService.validate(realm, password);
    if (!validation.valid) {
      return res.redirect(
        `/realms/${realm.name}/reset-password?token=${token}&error=${encodeURIComponent(validation.errors.join('. '))}`,
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
      data: { passwordHash, passwordChangedAt: new Date() },
    });

    // Record password history
    const user = await this.prisma.user.findUnique({ where: { id: result.userId } });
    if (user) {
      await this.passwordPolicyService.recordHistory(
        user.id, realm.id, passwordHash, realm.passwordHistoryCount,
      );
    }

    const info = encodeURIComponent('Your password has been reset. You can now sign in.');
    res.redirect(`/realms/${realm.name}/login?info=${info}`);
  }
}
