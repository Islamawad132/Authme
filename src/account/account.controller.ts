import {
  Controller,
  Get,
  Post,
  Render,
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

@ApiExcludeController()
@Controller('realms/:realmName/account')
@UseGuards(RealmGuard)
@Public()
export class AccountController {
  constructor(
    private readonly loginService: LoginService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  private async getSessionUser(realm: Realm, req: Request) {
    const sessionToken = req.cookies?.['AUTHME_SESSION'];
    if (!sessionToken) return null;
    return this.loginService.validateLoginSession(realm, sessionToken);
  }

  @Get()
  @Render('account')
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

    return res.render('account', {
      layout: 'layouts/main',
      pageTitle: 'My Account',
      realmName: realm.name,
      realmDisplayName: realm.displayName ?? realm.name,
      username: user.username,
      email: user.email ?? '',
      emailVerified: user.emailVerified,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
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

    if (newPassword.length < 8) {
      return res.redirect(`/realms/${realm.name}/account?error=${encodeURIComponent('New password must be at least 8 characters.')}`);
    }

    // Verify current password
    if (!user.passwordHash) {
      return res.redirect(`/realms/${realm.name}/account?error=${encodeURIComponent('Cannot change password for this account.')}`);
    }

    const valid = await this.crypto.verifyPassword(user.passwordHash, currentPassword);
    if (!valid) {
      return res.redirect(`/realms/${realm.name}/account?error=${encodeURIComponent('Current password is incorrect.')}`);
    }

    const passwordHash = await this.crypto.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    res.redirect(`/realms/${realm.name}/account?success=${encodeURIComponent('Password changed successfully.')}`);
  }
}
