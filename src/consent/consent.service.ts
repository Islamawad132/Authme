import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';

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
  private readonly pendingRequests = new Map<string, ConsentRequest>();

  constructor(private readonly prisma: PrismaService) {}

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
   * Store a pending consent request in memory. Returns the request ID.
   */
  storeConsentRequest(data: ConsentRequest): string {
    const id = randomBytes(16).toString('hex');
    this.pendingRequests.set(id, data);

    // Auto-cleanup after 10 minutes
    setTimeout(() => this.pendingRequests.delete(id), 10 * 60 * 1000);

    return id;
  }

  /**
   * Retrieve and remove a pending consent request.
   */
  getConsentRequest(id: string): ConsentRequest | undefined {
    const req = this.pendingRequests.get(id);
    if (req) this.pendingRequests.delete(id);
    return req;
  }
}
