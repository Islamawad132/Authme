import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Realm, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';

@Injectable()
export class LoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async validateCredentials(
    realm: Realm,
    username: string,
    password: string,
  ): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { realmId_username: { realmId: realm.id, username } },
    });

    if (!user || !user.enabled || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.crypto.verifyPassword(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async createLoginSession(
    realm: Realm,
    user: User,
    ip?: string,
    userAgent?: string,
  ): Promise<string> {
    const token = this.crypto.generateSecret(32);
    const tokenHash = this.crypto.sha256(token);

    await this.prisma.loginSession.create({
      data: {
        userId: user.id,
        realmId: realm.id,
        tokenHash,
        ipAddress: ip,
        userAgent,
        expiresAt: new Date(Date.now() + realm.refreshTokenLifespan * 1000),
      },
    });

    return token;
  }

  async validateLoginSession(
    realm: Realm,
    sessionToken: string,
  ): Promise<User | null> {
    const tokenHash = this.crypto.sha256(sessionToken);

    const session = await this.prisma.loginSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.realmId !== realm.id || session.expiresAt < new Date()) {
      return null;
    }

    if (!session.user.enabled) {
      return null;
    }

    return session.user;
  }
}
