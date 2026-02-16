import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';

export interface ConsentRequest {
  userId: string;
  clientId: string;
  clientName: string;
  realmName: string;
  scopes: string[];
  oauthParams: Record<string, string>;
}

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Check if a user has already granted consent for the requested scopes.
   */
  async hasConsent(
    userId: string,
    clientId: string,
    requestedScopes: string[],
  ): Promise<boolean> {
    const consent = await this.prisma.userConsent.findUnique({
      where: { userId_clientId: { userId, clientId } },
    });

    if (!consent) return false;

    // Check that every requested scope is covered by the stored consent
    return requestedScopes.every((scope) => consent.scopes.includes(scope));
  }

  /**
   * Grant consent: upsert the consent record with the given scopes.
   */
  async grantConsent(userId: string, clientId: string, scopes: string[]) {
    return this.prisma.userConsent.upsert({
      where: { userId_clientId: { userId, clientId } },
      create: { userId, clientId, scopes },
      update: { scopes },
    });
  }

  /**
   * Revoke consent for a user-client pair.
   */
  async revokeConsent(userId: string, clientId: string) {
    await this.prisma.userConsent.deleteMany({
      where: { userId, clientId },
    });
  }

  /**
   * Store a pending consent request in DB. Returns a token for retrieval.
   */
  async storeConsentRequest(data: ConsentRequest): Promise<string> {
    const token = this.crypto.generateSecret(16);
    const tokenHash = this.crypto.sha256(token);

    await this.prisma.pendingAction.create({
      data: {
        tokenHash,
        type: 'consent_request',
        data: data as any,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min TTL
      },
    });

    return token;
  }

  /**
   * Retrieve and remove a pending consent request.
   */
  async getConsentRequest(token: string): Promise<ConsentRequest | undefined> {
    const tokenHash = this.crypto.sha256(token);

    const action = await this.prisma.pendingAction.findUnique({
      where: { tokenHash },
    });

    if (!action || action.type !== 'consent_request') return undefined;
    if (action.expiresAt < new Date()) {
      await this.prisma.pendingAction.delete({ where: { id: action.id } });
      return undefined;
    }

    // Consume the request (one-time use)
    await this.prisma.pendingAction.delete({ where: { id: action.id } });

    return action.data as unknown as ConsentRequest;
  }

  @Interval(120_000)
  async cleanupExpiredConsentRequests(): Promise<void> {
    const { count } = await this.prisma.pendingAction.deleteMany({
      where: { type: 'consent_request', expiresAt: { lt: new Date() } },
    });
    if (count > 0) {
      this.logger.debug(`Cleaned up ${count} expired consent requests`);
    }
  }
}
