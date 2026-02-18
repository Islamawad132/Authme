import {
  Controller,
  Get,
  Post,
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
import { ThemeRenderService } from '../theme/theme-render.service.js';
import { ThemeEmailService } from '../theme/theme-email.service.js';
import { EventsService } from '../events/events.service.js';
import { LoginEventType } from '../events/event-types.js';

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
    private readonly themeRender: ThemeRenderService,
    private readonly themeEmail: ThemeEmailService,
    private readonly eventsService: EventsService,
  ) {}

  // ─── LOGIN ──────────────────────────────────────────────

  @Get('login')
  showLoginForm(
    @CurrentRealm() realm: Realm,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    this.themeRender.render(res, realm, 'login', 'login', {
      pageTitle: 'Sign In',
      registrationAllowed: realm.registrationAllowed,
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
    });
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

      // Check email verification requirement
      if (realm.requireEmailVerification && user.email && !user.emailVerified) {
        const params = new URLSearchParams();
        params.set('error', 'Please verify your email address before signing in. Check your inbox for the verification link.');
        for (const key of ['client_id', 'redirect_uri', 'response_type', 'scope', 'state', 'nonce', 'code_challenge', 'code_challenge_method']) {
          if (body[key]) params.set(key, body[key]);
        }
        return res.redirect(`/realms/${realm.name}/login?${params.toString()}`);
      }

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
        const challengeToken = await this.mfaService.createMfaChallenge(
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
      this.eventsService.recordLoginEvent({
        realmId: realm.id,
        type: LoginEventType.LOGIN_ERROR,
        clientId: body['client_id'],
        ipAddress: req.ip,
        error: err.message ?? 'Invalid credentials',
      });

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

    this.eventsService.recordLoginEvent({
      realmId: realm.id,
      type: LoginEventType.LOGIN,
      userId: user.id,
      clientId: oauthParams['client_id'],
      ipAddress: req.ip,
    });

    if (!oauthParams['client_id']) {
      return res.redirect(302, `/realms/${realm.name}/account`);
    }

    const client = await this.oauthService.validateAuthRequest(realm, oauthParams as any);

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
        return res.redirect(302, `/realms/${realm.name}/consent?req=${reqId}`);
      }
    }

    const result = await this.oauthService.authorizeWithUser(realm, user, oauthParams as any);
    res.redirect(302, result.redirectUrl);
  }

  // ─── MFA / TOTP ───────────────────────────────────────────

  @Get('totp')
  showTotpForm(
    @CurrentRealm() realm: Realm,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    this.themeRender.render(res, realm, 'login', 'totp', {
      pageTitle: 'Two-Factor Authentication',
      error: error ?? '',
    });
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

    // Validate challenge and track attempt count (does not consume the challenge)
    const challenge = await this.mfaService.validateMfaChallengeWithAttemptCheck(challengeToken);
    if (!challenge) {
      res.clearCookie('AUTHME_MFA_CHALLENGE', { path: `/realms/${realm.name}` });
      return res.redirect(`/realms/${realm.name}/login?error=${encodeURIComponent('MFA session expired or too many failed attempts. Please login again.')}`);
    }

    const code = body['code'];
    const recoveryCode = body['recoveryCode'];

    let verified = false;
    if (code) {
      verified = await this.mfaService.verifyTotp(challenge.userId, code);
    } else if (recoveryCode) {
      verified = await this.mfaService.verifyRecoveryCode(challenge.userId, recoveryCode);
    }

    if (!verified) {
      this.eventsService.recordLoginEvent({
        realmId: realm.id,
        type: LoginEventType.MFA_VERIFY_ERROR,
        userId: challenge.userId,
        ipAddress: req.ip,
        error: 'Invalid MFA code',
      });
      // Same challenge token is reused — attempt counter was already incremented
      return res.redirect(`/realms/${realm.name}/totp?error=${encodeURIComponent('Invalid code. Please try again.')}`);
    }

    // MFA verified — consume the challenge and clear the cookie
    await this.mfaService.consumeMfaChallenge(challengeToken);
    res.clearCookie('AUTHME_MFA_CHALLENGE', { path: `/realms/${realm.name}` });

    // MFA verified — complete login
    const user = await this.loginService.findUserById(challenge.userId);
    if (!user) {
      return res.redirect(`/realms/${realm.name}/login?error=${encodeURIComponent('User not found.')}`);
    }

    return await this.completeLogin(realm, user, body, challenge.oauthParams ?? {}, req, res);
  }

  // ─── CHANGE PASSWORD (forced) ─────────────────────────────

  @Get('change-password')
  showChangePasswordForm(
    @CurrentRealm() realm: Realm,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const policyHints: string[] = [];
    if (realm.passwordMinLength > 1) policyHints.push(`At least ${realm.passwordMinLength} characters`);
    if (realm.passwordRequireUppercase) policyHints.push('At least one uppercase letter');
    if (realm.passwordRequireLowercase) policyHints.push('At least one lowercase letter');
    if (realm.passwordRequireDigits) policyHints.push('At least one digit');
    if (realm.passwordRequireSpecialChars) policyHints.push('At least one special character');

    this.themeRender.render(res, realm, 'login', 'change-password', {
      pageTitle: 'Change Password',
      token: query['token'] ?? '',
      error: query['error'] ?? '',
      info: query['info'] ?? '',
      policyHints: policyHints.length > 0 ? policyHints : null,
    });
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
  async showConsentForm(
    @CurrentRealm() realm: Realm,
    @Query('req') reqId: string,
    @Res() res: Response,
  ) {
    if (!reqId) {
      throw new BadRequestException('Missing consent request ID');
    }

    const consentReq = await this.consentService.getConsentRequest(reqId);
    if (!consentReq) {
      throw new BadRequestException('Consent request expired or invalid');
    }

    const newReqId = await this.consentService.storeConsentRequest(consentReq);

    const scopeDescriptions = consentReq.scopes.map(
      (s) => SCOPE_DESCRIPTIONS[s] ?? s,
    );

    this.themeRender.render(res, realm, 'login', 'consent', {
      pageTitle: 'Grant Access',
      clientName: consentReq.clientName,
      scopes: scopeDescriptions,
      authReqId: newReqId,
    });
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

    const consentReq = await this.consentService.getConsentRequest(reqId);
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

  // ─── REGISTRATION ──────────────────────────────────────

  @Get('register')
  showRegistrationForm(
    @CurrentRealm() realm: Realm,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    if (!realm.registrationAllowed) {
      return res.redirect(
        `/realms/${realm.name}/login?error=${encodeURIComponent('Registration is not allowed for this realm.')}`,
      );
    }

    const hints: string[] = [];
    if (realm.passwordMinLength > 1) hints.push(`at least ${realm.passwordMinLength} characters`);
    if (realm.passwordRequireUppercase) hints.push('an uppercase letter');
    if (realm.passwordRequireLowercase) hints.push('a lowercase letter');
    if (realm.passwordRequireDigits) hints.push('a digit');
    if (realm.passwordRequireSpecialChars) hints.push('a special character');

    this.themeRender.render(res, realm, 'login', 'register', {
      pageTitle: 'Create Account',
      passwordMinLength: realm.passwordMinLength || 8,
      passwordHint: hints.length ? `Must contain ${hints.join(', ')}` : '',
      username: query['username'] ?? '',
      email: query['email'] ?? '',
      firstName: query['firstName'] ?? '',
      lastName: query['lastName'] ?? '',
      error: query['error'] ?? '',
      info: query['info'] ?? '',
    });
  }

  @Post('register')
  async handleRegistration(
    @CurrentRealm() realm: Realm,
    @Body() body: Record<string, string>,
    @Res() res: Response,
  ) {
    if (!realm.registrationAllowed) {
      return res.redirect(
        `/realms/${realm.name}/login?error=${encodeURIComponent('Registration is not allowed for this realm.')}`,
      );
    }

    const username = (body['username'] ?? '').trim();
    const email = (body['email'] ?? '').trim();
    const firstName = (body['firstName'] ?? '').trim();
    const lastName = (body['lastName'] ?? '').trim();
    const password = body['password'] ?? '';
    const confirmPassword = body['confirmPassword'] ?? '';

    const preserveFields = `&username=${encodeURIComponent(username)}&email=${encodeURIComponent(email)}&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`;

    if (!username || username.length < 2) {
      return res.redirect(
        `/realms/${realm.name}/register?error=${encodeURIComponent('Username must be at least 2 characters.')}${preserveFields}`,
      );
    }

    if (!email) {
      return res.redirect(
        `/realms/${realm.name}/register?error=${encodeURIComponent('Email is required.')}${preserveFields}`,
      );
    }

    if (!password) {
      return res.redirect(
        `/realms/${realm.name}/register?error=${encodeURIComponent('Password is required.')}${preserveFields}`,
      );
    }

    if (password !== confirmPassword) {
      return res.redirect(
        `/realms/${realm.name}/register?error=${encodeURIComponent('Passwords do not match.')}${preserveFields}`,
      );
    }

    // Validate against password policy
    const validation = this.passwordPolicyService.validate(realm, password);
    if (!validation.valid) {
      return res.redirect(
        `/realms/${realm.name}/register?error=${encodeURIComponent(validation.errors.join('. '))}${preserveFields}`,
      );
    }

    // Check for duplicate username
    const existingByUsername = await this.prisma.user.findUnique({
      where: { realmId_username: { realmId: realm.id, username } },
    });
    if (existingByUsername) {
      return res.redirect(
        `/realms/${realm.name}/register?error=${encodeURIComponent('An account with that username already exists.')}${preserveFields}`,
      );
    }

    // Check for duplicate email
    const existingByEmail = await this.prisma.user.findUnique({
      where: { realmId_email: { realmId: realm.id, email } },
    });
    if (existingByEmail) {
      return res.redirect(
        `/realms/${realm.name}/register?error=${encodeURIComponent('An account with that email already exists.')}${preserveFields}`,
      );
    }

    // Create user
    const passwordHash = await this.crypto.hashPassword(password);
    const user = await this.prisma.user.create({
      data: {
        realmId: realm.id,
        username,
        email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        enabled: true,
        passwordHash,
        passwordChangedAt: new Date(),
      },
    });

    // Record password history
    if (realm.passwordHistoryCount > 0) {
      await this.passwordPolicyService.recordHistory(
        user.id, realm.id, passwordHash, realm.passwordHistoryCount,
      );
    }

    this.eventsService.recordLoginEvent({
      realmId: realm.id,
      type: LoginEventType.REGISTER,
      userId: user.id,
    });

    // Send verification email
    if (email) {
      try {
        const configured = await this.emailService.isConfigured(realm.name);
        if (configured) {
          const rawToken = await this.verificationService.createToken(user.id, 'email_verification', 86400);
          const baseUrl = this.config.get<string>('BASE_URL', 'http://localhost:3000');
          const verifyUrl = `${baseUrl}/realms/${realm.name}/verify-email?token=${rawToken}`;

          const fullRealm = await this.prisma.realm.findUnique({ where: { name: realm.name } });
          if (fullRealm) {
            const subject = this.themeEmail.getSubject(fullRealm, 'verifyEmailSubject');
            const html = this.themeEmail.renderEmail(fullRealm, 'verify-email', { verifyUrl });
            await this.emailService.sendEmail(realm.name, email, subject, html);
          }
        }
      } catch {
        // Don't block registration if email fails
      }
    }

    const info = encodeURIComponent('Account created successfully! Please check your email to verify your account, then sign in.');
    res.redirect(`/realms/${realm.name}/login?info=${info}`);
  }

  // ─── EMAIL VERIFICATION ─────────────────────────────────

  @Get('verify-email')
  async verifyEmail(
    @CurrentRealm() realm: Realm,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    if (!token) {
      return this.themeRender.render(res, realm, 'login', 'verify-email', {
        pageTitle: 'Email Verification',
        success: false,
        error: 'Missing verification token.',
      });
    }

    const result = await this.verificationService.validateToken(token, 'email_verification');
    if (!result) {
      return this.themeRender.render(res, realm, 'login', 'verify-email', {
        pageTitle: 'Email Verification',
        success: false,
        error: 'This verification link is invalid or has expired.',
      });
    }

    await this.prisma.user.update({
      where: { id: result.userId },
      data: { emailVerified: true },
    });

    this.themeRender.render(res, realm, 'login', 'verify-email', {
      pageTitle: 'Email Verification',
      success: true,
    });
  }

  // ─── FORGOT / RESET PASSWORD ────────────────────────────

  @Get('forgot-password')
  showForgotPasswordForm(
    @CurrentRealm() realm: Realm,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    this.themeRender.render(res, realm, 'login', 'forgot-password', {
      pageTitle: 'Forgot Password',
      info: query['info'] ?? '',
      error: query['error'] ?? '',
    });
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

        const fullRealm = await this.prisma.realm.findUnique({ where: { name: realm.name } });
        if (fullRealm) {
          const subject = this.themeEmail.getSubject(fullRealm, 'resetPasswordSubject');
          const html = this.themeEmail.renderEmail(fullRealm, 'reset-password', { resetUrl });
          await this.emailService.sendEmail(realm.name, email, subject, html);
        }
      }
    }

    res.redirect(`/realms/${realm.name}/forgot-password?info=${successMessage}`);
  }

  @Get('reset-password')
  async showResetPasswordForm(
    @CurrentRealm() realm: Realm,
    @Query('token') token: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (!token) {
      return this.themeRender.render(res, realm, 'login', 'reset-password', {
        pageTitle: 'Reset Password',
        error: 'Missing reset token.',
        token: '',
      });
    }

    const tokenHash = this.crypto.sha256(token);
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.type !== 'password_reset' || record.expiresAt < new Date()) {
      return this.themeRender.render(res, realm, 'login', 'reset-password', {
        pageTitle: 'Reset Password',
        error: 'This reset link is invalid or has expired.',
        token: '',
      });
    }

    this.themeRender.render(res, realm, 'login', 'reset-password', {
      pageTitle: 'Reset Password',
      token,
      error: error ?? '',
    });
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

    this.eventsService.recordLoginEvent({
      realmId: realm.id,
      type: LoginEventType.PASSWORD_RESET,
      userId: result.userId,
    });

    const info = encodeURIComponent('Your password has been reset. You can now sign in.');
    res.redirect(`/realms/${realm.name}/login?info=${info}`);
  }
}
