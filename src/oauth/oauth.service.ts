import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Realm, User, Client } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuthorizeParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  nonce?: string;
}

@Injectable()
export class OAuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate the OAuth authorization request parameters and return the client.
   * Does NOT authenticate the user — that's the login page's job.
   */
  async validateAuthRequest(
    realm: Realm,
    params: AuthorizeParams,
  ): Promise<Client> {
    if (params.response_type !== 'code') {
      throw new BadRequestException('Only response_type=code is supported');
    }

    if (!params.client_id || !params.redirect_uri) {
      throw new BadRequestException('client_id and redirect_uri are required');
    }

    const client = await this.prisma.client.findUnique({
      where: {
        realmId_clientId: { realmId: realm.id, clientId: params.client_id },
      },
    });

    if (!client || !client.enabled) {
      throw new NotFoundException('Client not found');
    }

    if (!client.redirectUris.includes(params.redirect_uri)) {
      throw new BadRequestException('Invalid redirect_uri');
    }

    if (!client.grantTypes.includes('authorization_code')) {
      throw new BadRequestException(
        'Client does not support authorization_code grant',
      );
    }

    if (params.code_challenge_method && params.code_challenge_method !== 'S256') {
      throw new BadRequestException('Only S256 code_challenge_method is supported');
    }

    return client;
  }

  /**
   * Generate an authorization code for an already-authenticated user.
   * Called after the login page validates credentials.
   */
  async authorizeWithUser(
    realm: Realm,
    user: User,
    params: AuthorizeParams,
  ): Promise<{ redirectUrl: string }> {
    const client = await this.validateAuthRequest(realm, params);

    const code = randomBytes(32).toString('hex');

    await this.prisma.authorizationCode.create({
      data: {
        code,
        clientId: client.id,
        userId: user.id,
        redirectUri: params.redirect_uri,
        scope: params.scope,
        codeChallenge: params.code_challenge,
        codeChallengeMethod: params.code_challenge_method,
        nonce: params.nonce,
        expiresAt: new Date(Date.now() + 60 * 1000),
      },
    });

    const redirectUrl = new URL(params.redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (params.state) {
      redirectUrl.searchParams.set('state', params.state);
    }

    return { redirectUrl: redirectUrl.toString() };
  }
}
