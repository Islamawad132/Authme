import { Injectable, UnauthorizedException, Optional } from '@nestjs/common';
import type { Realm, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { BruteForceService } from '../brute-force/brute-force.service.js';
import { UserFederationService } from '../user-federation/user-federation.service.js';

@Injectable()
export class LoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly bruteForceService: BruteForceService,
    @Optional() private readonly federationService?: UserFederationService,
  ) {}

  async validateCredentials(
    realm: Realm,
    username: string,
    password: string,
    ip?: string,
  ): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { realmId_username: { realmId: realm.id, username } },
    });

    // If user exists with a federation link, authenticate via LDAP
    if (user && user.federationLink && this.federationService) {
      if (!user.enabled) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const lockStatus = this.bruteForceService.checkLocked(realm, user);
      if (lockStatus.locked) {
        throw new UnauthorizedException('Account is temporarily locked. Please try again later.');
      }

      const result = await this.federationService.authenticateViaFederation(
        realm.id, username, password,
      );

      if (result.authenticated) {
        await this.bruteForceService.resetFailures(realm.id, user.id);
        return user;
      }

      await this.bruteForceService.recordFailure(realm, user.id, ip);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Local user with password hash
    if (user && user.enabled && user.passwordHash) {
      const lockStatus = this.bruteForceService.checkLocked(realm, user);
      if (lockStatus.locked) {
        throw new UnauthorizedException('Account is temporarily locked. Please try again later.');
      }

      const valid = await this.crypto.verifyPassword(user.passwordHash, password);
      if (!valid) {
        await this.bruteForceService.recordFailure(realm, user.id, ip);
        throw new UnauthorizedException('Invalid credentials');
      }

      await this.bruteForceService.resetFailures(realm.id, user.id);
      return user;
    }

    // User not found locally — try LDAP federation (import on first login)
    if (!user && this.federationService) {
      const result = await this.federationService.authenticateViaFederation(
        realm.id, username, password,
      );

      if (result.authenticated && result.userId) {
        const importedUser = await this.prisma.user.findUnique({
          where: { id: result.userId },
        });
        if (importedUser) {
          return importedUser;
        }
      }
    }

    throw new UnauthorizedException('Invalid credentials');
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

  async findUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }
}
