import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { JwkService } from '../crypto/jwk.service.js';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly jwkService: JwkService,
  ) {}

  async login(username: string, password: string) {
    const masterRealm = await this.prisma.realm.findUnique({
      where: { name: 'master' },
    });

    if (!masterRealm) {
      throw new UnauthorizedException('Admin system not initialized');
    }

    const user = await this.prisma.user.findUnique({
      where: { realmId_username: { realmId: masterRealm.id, username } },
    });

    if (!user || !user.enabled || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.crypto.verifyPassword(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Get admin roles
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true },
    });

    const roles = userRoles.map((ur) => ur.role.name);

    // Must have at least one admin role
    if (!roles.some((r) => ['super-admin', 'realm-admin', 'view-only'].includes(r))) {
      throw new UnauthorizedException('User does not have admin access');
    }

    // Sign admin JWT with master realm signing key
    const signingKey = await this.prisma.realmSigningKey.findFirst({
      where: { realmId: masterRealm.id, active: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!signingKey) {
      throw new Error('No signing key found for master realm');
    }

    const baseUrl = process.env['BASE_URL'] ?? 'http://localhost:3000';
    const token = await this.jwkService.signJwt(
      {
        iss: `${baseUrl}/realms/master`,
        sub: user.id,
        typ: 'admin',
        realm_access: { roles },
        preferred_username: user.username,
      },
      signingKey.privateKey,
      signingKey.kid,
      3600, // 1 hour
    );

    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: 3600,
    };
  }

  async validateAdminToken(
    token: string,
  ): Promise<{ userId: string; roles: string[] }> {
    const masterRealm = await this.prisma.realm.findUnique({
      where: { name: 'master' },
    });

    if (!masterRealm) {
      throw new UnauthorizedException('Admin system not initialized');
    }

    const signingKey = await this.prisma.realmSigningKey.findFirst({
      where: { realmId: masterRealm.id, active: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!signingKey) {
      throw new UnauthorizedException('No signing key found');
    }

    try {
      const payload = await this.jwkService.verifyJwt(token, signingKey.publicKey);

      if (payload['typ'] !== 'admin') {
        throw new UnauthorizedException('Not an admin token');
      }

      const realmAccess = payload['realm_access'] as { roles?: string[] } | undefined;
      const roles = realmAccess?.roles ?? [];

      return { userId: payload.sub as string, roles };
    } catch {
      throw new UnauthorizedException('Invalid admin token');
    }
  }

  hasRole(roles: string[], required: string): boolean {
    if (roles.includes('super-admin')) return true;
    return roles.includes(required);
  }
}
