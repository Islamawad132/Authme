import { Injectable, Logger } from '@nestjs/common';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import type { Realm } from '@prisma/client';

interface MfaChallenge {
  userId: string;
  realmId: string;
  oauthParams?: Record<string, string>;
  expiresAt: number;
}

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly challenges = new Map<string, MfaChallenge>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {
    // Cleanup expired challenges every 60s
    setInterval(() => this.cleanupChallenges(), 60_000);
  }

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

  async verifyAndActivateTotp(userId: string, code: string): Promise<boolean> {
    const credential = await this.prisma.userCredential.findUnique({
      where: { userId_type: { userId, type: 'totp' } },
    });

    if (!credential || credential.verified) return false;

    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(credential.secretKey),
      algorithm: credential.algorithm,
      digits: credential.digits,
      period: credential.period,
    });

    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) return false;

    await this.prisma.userCredential.update({
      where: { id: credential.id },
      data: { verified: true },
    });

    // Generate recovery codes
    const recoveryCodes = await this.generateRecoveryCodes(userId);
    return true;
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

  createMfaChallenge(
    userId: string,
    realmId: string,
    oauthParams?: Record<string, string>,
  ): string {
    const token = this.crypto.generateSecret(32);
    this.challenges.set(token, {
      userId,
      realmId,
      oauthParams,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min TTL
    });
    return token;
  }

  validateMfaChallenge(
    challengeToken: string,
  ): { userId: string; realmId: string; oauthParams?: Record<string, string> } | null {
    const challenge = this.challenges.get(challengeToken);
    if (!challenge) return null;
    if (challenge.expiresAt < Date.now()) {
      this.challenges.delete(challengeToken);
      return null;
    }
    this.challenges.delete(challengeToken);
    return { userId: challenge.userId, realmId: challenge.realmId, oauthParams: challenge.oauthParams };
  }

  private cleanupChallenges(): void {
    const now = Date.now();
    for (const [key, val] of this.challenges) {
      if (val.expiresAt < now) this.challenges.delete(key);
    }
  }
}
