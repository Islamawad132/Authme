import {
  Controller,
  Get,
  Post,
  UseGuards,
  Body,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { Realm } from '@prisma/client';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { LoginService } from '../login/login.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { PasswordPolicyService } from '../password-policy/password-policy.service.js';
import { MfaService } from '../mfa/mfa.service.js';
import { ThemeRenderService } from '../theme/theme-render.service.js';

@ApiExcludeController()
@Controller('realms/:realmName/account')
@UseGuards(RealmGuard)
@Public()
export class AccountController {
  constructor(
    private readonly loginService: LoginService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly mfaService: MfaService,
    private readonly themeRender: ThemeRenderService,
  ) {}

  private async getSessionUser(realm: Realm, req: Request) {
    const sessionToken = req.cookies?.['AUTHME_SESSION'];
    if (!sessionToken) return null;
    return this.loginService.validateLoginSession(realm, sessionToken);
  }

  @Get()
  async showAccount(
    @CurrentRealm() realm: Realm,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = await this.getSessionUser(realm, req);
    if (!user) {
      return res.redirect(`/realms/${realm.name}/login`);
    }

    const query = req.query as Record<string, string>;
    const mfaEnabled = await this.mfaService.isMfaEnabled(user.id);

    this.themeRender.render(res, realm, 'account', 'account', {
      pageTitle: 'My Account',
      username: user.username,
      email: user.email ?? '',
      emailVerified: user.emailVerified,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      mfaEnabled,
      success: query['success'] ?? '',
      error: query['error'] ?? '',
    });
  }

  @Post('profile')
  async updateProfile(
    @CurrentRealm() realm: Realm,
    @Body() body: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = await this.getSessionUser(realm, req);
    if (!user) {
      return res.redirect(`/realms/${realm.name}/login`);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: body['firstName'] || null,
        lastName: body['lastName'] || null,
      },
    });

    res.redirect(`/realms/${realm.name}/account?success=${encodeURIComponent('Profile updated successfully.')}`);
  }

  @Post('password')
  async changePassword(
    @CurrentRealm() realm: Realm,
    @Body() body: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = await this.getSessionUser(realm, req);
    if (!user) {
      return res.redirect(`/realms/${realm.name}/login`);
    }

    const currentPassword = body['currentPassword'];
    const newPassword = body['newPassword'];
    const confirmPassword = body['confirmPassword'];

    if (!currentPassword || !newPassword) {
      return res.redirect(`/realms/${realm.name}/account?error=${encodeURIComponent('All password fields are required.')}`);
    }

    if (newPassword !== confirmPassword) {
      return res.redirect(`/realms/${realm.name}/account?error=${encodeURIComponent('New passwords do not match.')}`);
    }

    // Validate against password policy
    const validation = this.passwordPolicyService.validate(realm, newPassword);
    if (!validation.valid) {
      return res.redirect(`/realms/${realm.name}/account?error=${encodeURIComponent(validation.errors.join('. '))}`);
    }

    // Verify current password
    if (!user.passwordHash) {
      return res.redirect(`/realms/${realm.name}/account?error=${encodeURIComponent('Cannot change password for this account.')}`);
    }

    const valid = await this.crypto.verifyPassword(user.passwordHash, currentPassword);
    if (!valid) {
      return res.redirect(`/realms/${realm.name}/account?error=${encodeURIComponent('Current password is incorrect.')}`);
    }

    // Check password history
    if (realm.passwordHistoryCount > 0) {
      const inHistory = await this.passwordPolicyService.checkHistory(
        user.id, realm.id, newPassword, realm.passwordHistoryCount,
      );
      if (inHistory) {
        return res.redirect(`/realms/${realm.name}/account?error=${encodeURIComponent('Password was used recently. Choose a different password.')}`);
      }
    }

    const passwordHash = await this.crypto.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });

    // Record password history
    await this.passwordPolicyService.recordHistory(
      user.id, realm.id, passwordHash, realm.passwordHistoryCount,
    );

    res.redirect(`/realms/${realm.name}/account?success=${encodeURIComponent('Password changed successfully.')}`);
  }

  // ─── TOTP SETUP ─────────────────────────────────────────

  @Get('totp-setup')
  async showTotpSetup(
    @CurrentRealm() realm: Realm,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = await this.getSessionUser(realm, req);
    if (!user) {
      return res.redirect(`/realms/${realm.name}/login`);
    }

    const query = req.query as Record<string, string>;
    const mfaEnabled = await this.mfaService.isMfaEnabled(user.id);
    if (mfaEnabled) {
      return res.redirect(`/realms/${realm.name}/account?info=${encodeURIComponent('Two-factor authentication is already enabled.')}`);
    }

    const setup = await this.mfaService.setupTotp(user.id, realm.name, user.username);

    this.themeRender.render(res, realm, 'account', 'totp-setup', {
      pageTitle: 'Set Up Two-Factor Authentication',
      qrCodeDataUrl: setup.qrCodeDataUrl,
      secret: setup.secret,
      error: query['error'] ?? '',
      info: query['info'] ?? '',
    });
  }

  @Post('totp-setup')
  async handleTotpSetup(
    @CurrentRealm() realm: Realm,
    @Body() body: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = await this.getSessionUser(realm, req);
    if (!user) {
      return res.redirect(`/realms/${realm.name}/login`);
    }

    const code = body['code'];
    if (!code) {
      return res.redirect(`/realms/${realm.name}/account/totp-setup?error=${encodeURIComponent('Please enter the verification code.')}`);
    }

    const recoveryCodes = await this.mfaService.verifyAndActivateTotp(user.id, code);
    if (!recoveryCodes) {
      return res.redirect(`/realms/${realm.name}/account/totp-setup?error=${encodeURIComponent('Invalid code. Please try again.')}`);
    }

    this.themeRender.render(res, realm, 'account', 'totp-setup', {
      pageTitle: 'Two-Factor Authentication Enabled',
      activated: true,
      recoveryCodes,
    });
  }

  @Post('totp-disable')
  async handleTotpDisable(
    @CurrentRealm() realm: Realm,
    @Body() body: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = await this.getSessionUser(realm, req);
    if (!user) {
      return res.redirect(`/realms/${realm.name}/login`);
    }

    const currentPassword = body['currentPassword'];
    if (!currentPassword || !user.passwordHash) {
      return res.redirect(`/realms/${realm.name}/account?error=${encodeURIComponent('Password is required to disable two-factor authentication.')}`);
    }

    const valid = await this.crypto.verifyPassword(user.passwordHash, currentPassword);
    if (!valid) {
      return res.redirect(`/realms/${realm.name}/account?error=${encodeURIComponent('Password is incorrect.')}`);
    }

    await this.mfaService.disableTotp(user.id);

    res.redirect(`/realms/${realm.name}/account?success=${encodeURIComponent('Two-factor authentication has been disabled.')}`);
  }
}
