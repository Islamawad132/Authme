import { Injectable, Logger } from '@nestjs/common';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import type { Realm } from '@prisma/client';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async setupTotp(userId: string, realmName: string, username: string) {
    // Delete any existing unverified credential
    await this.prisma.userCredential.deleteMany({
      where: { userId, type: 'totp', verified: false },
    });

    const secret = new OTPAuth.Secret({ size: 20 });

    const totp = new OTPAuth.TOTP({
      issuer: `AuthMe (${realmName})`,
      label: username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    await this.prisma.userCredential.create({
      data: {
        userId,
        type: 'totp',
        secretKey: secret.base32,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        verified: false,
      },
    });

    const otpauthUrl = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return {
      secret: secret.base32,
      qrCodeDataUrl,
      otpauthUrl,
    };
  }

  async verifyAndActivateTotp(userId: string, code: string): Promise<string[] | null> {
    const credential = await this.prisma.userCredential.findUnique({
      where: { userId_type: { userId, type: 'totp' } },
    });

    if (!credential || credential.verified) return null;

    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(credential.secretKey),
      algorithm: credential.algorithm,
      digits: credential.digits,
      period: credential.period,
    });

    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) return null;

    await this.prisma.userCredential.update({
      where: { id: credential.id },
      data: { verified: true },
    });

    // Generate and return recovery codes (single generation point)
    return this.generateRecoveryCodes(userId);
  }

  async verifyTotp(userId: string, code: string): Promise<boolean> {
    const credential = await this.prisma.userCredential.findUnique({
      where: { userId_type: { userId, type: 'totp' } },
    });

    if (!credential || !credential.verified) return false;

    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(credential.secretKey),
      algorithm: credential.algorithm,
      digits: credential.digits,
      period: credential.period,
    });

    const delta = totp.validate({ token: code, window: 1 });
    return delta !== null;
  }

  async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
    const codeHash = this.crypto.sha256(code.toLowerCase().replace(/\s/g, ''));

    const recoveryCode = await this.prisma.recoveryCode.findFirst({
      where: { userId, codeHash, used: false },
    });

    if (!recoveryCode) return false;

    await this.prisma.recoveryCode.update({
      where: { id: recoveryCode.id },
      data: { used: true },
    });

    return true;
  }

  async generateRecoveryCodes(userId: string): Promise<string[]> {
    // Delete existing codes
    await this.prisma.recoveryCode.deleteMany({ where: { userId } });

    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = this.crypto.generateSecret(4).toUpperCase(); // 8-char hex
      codes.push(code);

      await this.prisma.recoveryCode.create({
        data: {
          userId,
          codeHash: this.crypto.sha256(code.toLowerCase()),
        },
      });
    }

    return codes;
  }

  async disableTotp(userId: string): Promise<void> {
    await this.prisma.userCredential.deleteMany({ where: { userId, type: 'totp' } });
    await this.prisma.recoveryCode.deleteMany({ where: { userId } });
  }

  async isMfaEnabled(userId: string): Promise<boolean> {
    const credential = await this.prisma.userCredential.findUnique({
      where: { userId_type: { userId, type: 'totp' } },
    });
    return !!credential?.verified;
  }

  async isMfaRequired(realm: Realm, userId: string): Promise<boolean> {
    if (realm.mfaRequired) return true;
    return this.isMfaEnabled(userId);
  }

  private static readonly MAX_MFA_ATTEMPTS = 5;

  async createMfaChallenge(
    userId: string,
    realmId: string,
    oauthParams?: Record<string, string>,
  ): Promise<string> {
    const token = this.crypto.generateSecret(32);
    const tokenHash = this.crypto.sha256(token);

    await this.prisma.pendingAction.create({
      data: {
        tokenHash,
        type: 'mfa_challenge',
        data: { userId, realmId, oauthParams, attempts: 0 } as any,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min TTL
      },
    });

    return token;
  }

  async validateMfaChallenge(
    challengeToken: string,
  ): Promise<{ userId: string; realmId: string; oauthParams?: Record<string, string> } | null> {
    const tokenHash = this.crypto.sha256(challengeToken);

    const action = await this.prisma.pendingAction.findUnique({
      where: { tokenHash },
    });

    if (!action || action.type !== 'mfa_challenge') return null;
    if (action.expiresAt < new Date()) {
      await this.prisma.pendingAction.delete({ where: { id: action.id } });
      return null;
    }

    // Consume the challenge (one-time use)
    await this.prisma.pendingAction.delete({ where: { id: action.id } });

    const data = action.data as any;
    return { userId: data.userId, realmId: data.realmId, oauthParams: data.oauthParams };
  }

  /**
   * Validates the challenge without consuming it, increments attempt counter.
   * Returns null if challenge is invalid, expired, or max attempts exceeded.
   */
  async validateMfaChallengeWithAttemptCheck(
    challengeToken: string,
  ): Promise<{ userId: string; realmId: string; oauthParams?: Record<string, string> } | null> {
    const tokenHash = this.crypto.sha256(challengeToken);

    const action = await this.prisma.pendingAction.findUnique({
      where: { tokenHash },
    });

    if (!action || action.type !== 'mfa_challenge') return null;
    if (action.expiresAt < new Date()) {
      await this.prisma.pendingAction.delete({ where: { id: action.id } });
      return null;
    }

    const data = action.data as any;
    const attempts = (data.attempts ?? 0) + 1;

    if (attempts > MfaService.MAX_MFA_ATTEMPTS) {
      // Too many attempts — delete challenge and force re-authentication
      await this.prisma.pendingAction.delete({ where: { id: action.id } });
      this.logger.warn(`MFA challenge exceeded max attempts for user ${data.userId}`);
      return null;
    }

    // Update attempt counter (keep the challenge alive for retries)
    await this.prisma.pendingAction.update({
      where: { id: action.id },
      data: { data: { ...data, attempts } as any },
    });

    return { userId: data.userId, realmId: data.realmId, oauthParams: data.oauthParams };
  }

  /**
   * Consumes (deletes) a challenge token after successful verification.
   */
  async consumeMfaChallenge(challengeToken: string): Promise<void> {
    const tokenHash = this.crypto.sha256(challengeToken);
    await this.prisma.pendingAction.delete({ where: { tokenHash } }).catch(() => {});
  }

  @Interval(60_000)
  async cleanupExpiredActions(): Promise<void> {
    const { count } = await this.prisma.pendingAction.deleteMany({
      where: { type: 'mfa_challenge', expiresAt: { lt: new Date() } },
    });
    if (count > 0) {
      this.logger.debug(`Cleaned up ${count} expired MFA challenges`);
    }
  }
}
