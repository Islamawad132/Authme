import { Injectable } from '@nestjs/common';
import type { Realm } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface SessionInfo {
  id: string;
  type: 'oauth' | 'sso';
  userId: string;
  username: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRealmSessions(realm: Realm): Promise<SessionInfo[]> {
    const [oauthSessions, ssoSessions] = await Promise.all([
      this.prisma.session.findMany({
        where: {
          user: { realmId: realm.id },
          expiresAt: { gt: new Date() },
        },
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.loginSession.findMany({
        where: {
          realmId: realm.id,
          expiresAt: { gt: new Date() },
        },
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return [
      ...oauthSessions.map((s) => ({
        id: s.id,
        type: 'oauth' as const,
        userId: s.userId,
        username: s.user.username,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
      ...ssoSessions.map((s) => ({
        id: s.id,
        type: 'sso' as const,
        userId: s.userId,
        username: s.user.username,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getUserSessions(realm: Realm, userId: string): Promise<SessionInfo[]> {
    const [oauthSessions, ssoSessions] = await Promise.all([
      this.prisma.session.findMany({
        where: {
          userId,
          user: { realmId: realm.id },
          expiresAt: { gt: new Date() },
        },
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.loginSession.findMany({
        where: {
          userId,
          realmId: realm.id,
          expiresAt: { gt: new Date() },
        },
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return [
      ...oauthSessions.map((s) => ({
        id: s.id,
        type: 'oauth' as const,
        userId: s.userId,
        username: s.user.username,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
      ...ssoSessions.map((s) => ({
        id: s.id,
        type: 'sso' as const,
        userId: s.userId,
        username: s.user.username,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async revokeSession(sessionId: string, type: 'oauth' | 'sso'): Promise<void> {
    if (type === 'oauth') {
      // Revoke all refresh tokens then delete the session
      await this.prisma.refreshToken.updateMany({
        where: { sessionId },
        data: { revoked: true },
      });
      await this.prisma.session.delete({ where: { id: sessionId } });
    } else {
      await this.prisma.loginSession.delete({ where: { id: sessionId } });
    }
  }

  async revokeAllUserSessions(realm: Realm, userId: string): Promise<void> {
    // Revoke all OAuth sessions
    const sessions = await this.prisma.session.findMany({
      where: { userId, user: { realmId: realm.id } },
      select: { id: true },
    });

    for (const session of sessions) {
      await this.prisma.refreshToken.updateMany({
        where: { sessionId: session.id },
        data: { revoked: true },
      });
    }

    await this.prisma.session.deleteMany({
      where: { userId, user: { realmId: realm.id } },
    });

    // Revoke all SSO sessions
    await this.prisma.loginSession.deleteMany({
      where: { userId, realmId: realm.id },
    });
  }
}
