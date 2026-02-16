import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Realm, ClientType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { ScopeSeedService } from '../scopes/scope-seed.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';

const CLIENT_SELECT = {
  id: true,
  realmId: true,
  clientId: true,
  clientType: true,
  name: true,
  description: true,
  enabled: true,
  redirectUris: true,
  webOrigins: true,
  grantTypes: true,
  requireConsent: true,
  backchannelLogoutUri: true,
  backchannelLogoutSessionRequired: true,
  serviceAccountUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly scopeSeedService: ScopeSeedService,
  ) {}

  async create(realm: Realm, dto: CreateClientDto) {
    const existing = await this.prisma.client.findUnique({
      where: {
        realmId_clientId: { realmId: realm.id, clientId: dto.clientId },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Client '${dto.clientId}' already exists in realm '${realm.name}'`,
      );
    }

    const clientType = (dto.clientType ?? 'CONFIDENTIAL') as ClientType;
    let rawSecret: string | undefined;
    let secretHash: string | undefined;

    if (clientType === 'CONFIDENTIAL') {
      rawSecret = this.crypto.generateSecret();
      secretHash = await this.crypto.hashPassword(rawSecret);
    }

    const grantTypes = dto.grantTypes ?? ['authorization_code'];

    // Create service account user if client_credentials grant is enabled
    let serviceAccountUserId: string | undefined;
    if (grantTypes.includes('client_credentials') && clientType === 'CONFIDENTIAL') {
      const saUsername = `service-account-${dto.clientId}`;
      const saUser = await this.prisma.user.create({
        data: {
          realmId: realm.id,
          username: saUsername,
          enabled: true,
        },
      });
      serviceAccountUserId = saUser.id;
    }

    const client = await this.prisma.client.create({
      data: {
        realmId: realm.id,
        clientId: dto.clientId,
        clientSecret: secretHash,
        clientType,
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled,
        redirectUris: dto.redirectUris ?? [],
        webOrigins: dto.webOrigins ?? [],
        grantTypes,
        requireConsent: dto.requireConsent ?? false,
        backchannelLogoutUri: dto.backchannelLogoutUri,
        backchannelLogoutSessionRequired: dto.backchannelLogoutSessionRequired,
        serviceAccountUserId,
      },
      select: CLIENT_SELECT,
    });

    // Assign default and optional scopes to the new client
    await this.assignBuiltInScopes(realm.id, client.id);

    return {
      ...client,
      ...(rawSecret
        ? { clientSecret: rawSecret, secretWarning: 'Store this secret securely. It will not be shown again.' }
        : {}),
    };
  }

  async findAll(realm: Realm) {
    return this.prisma.client.findMany({
      where: { realmId: realm.id },
      select: CLIENT_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByClientId(realm: Realm, clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: {
        realmId_clientId: { realmId: realm.id, clientId },
      },
      select: CLIENT_SELECT,
    });
    if (!client) {
      throw new NotFoundException(`Client '${clientId}' not found`);
    }
    return client;
  }

  async update(realm: Realm, clientId: string, dto: UpdateClientDto) {
    await this.findByClientId(realm, clientId);
    return this.prisma.client.update({
      where: {
        realmId_clientId: { realmId: realm.id, clientId },
      },
      data: {
        name: dto.name,
        description: dto.description,
        clientType: dto.clientType as ClientType | undefined,
        enabled: dto.enabled,
        redirectUris: dto.redirectUris,
        webOrigins: dto.webOrigins,
        grantTypes: dto.grantTypes,
        requireConsent: dto.requireConsent,
        backchannelLogoutUri: dto.backchannelLogoutUri,
        backchannelLogoutSessionRequired: dto.backchannelLogoutSessionRequired,
      },
      select: CLIENT_SELECT,
    });
  }

  async remove(realm: Realm, clientId: string) {
    const client = await this.findByClientId(realm, clientId);

    // Delete service account user if it exists
    if (client.serviceAccountUserId) {
      await this.prisma.user.delete({
        where: { id: client.serviceAccountUserId },
      }).catch(() => { /* user may already be deleted */ });
    }

    await this.prisma.client.delete({
      where: {
        realmId_clientId: { realmId: realm.id, clientId },
      },
    });
  }

  async getServiceAccount(realm: Realm, clientId: string) {
    const client = await this.findByClientId(realm, clientId);
    if (!client.serviceAccountUserId) {
      throw new NotFoundException('Client does not have a service account');
    }
    return this.prisma.user.findUnique({
      where: { id: client.serviceAccountUserId },
      select: {
        id: true,
        username: true,
        enabled: true,
        createdAt: true,
        userRoles: { include: { role: true } },
      },
    });
  }

  async regenerateSecret(realm: Realm, clientId: string) {
    const client = await this.findByClientId(realm, clientId);
    if (client.clientType !== 'CONFIDENTIAL') {
      throw new ConflictException('Cannot generate secret for a PUBLIC client');
    }

    const rawSecret = this.crypto.generateSecret();
    const secretHash = await this.crypto.hashPassword(rawSecret);

    await this.prisma.client.update({
      where: {
        realmId_clientId: { realmId: realm.id, clientId },
      },
      data: { clientSecret: secretHash },
    });

    return {
      clientId,
      clientSecret: rawSecret,
      secretWarning: 'Store this secret securely. It will not be shown again.',
    };
  }

  private async assignBuiltInScopes(realmId: string, clientDbId: string) {
    const defaultNames = this.scopeSeedService.getDefaultScopeNames();
    const optionalNames = this.scopeSeedService.getOptionalScopeNames();

    const allScopes = await this.prisma.clientScope.findMany({
      where: { realmId, name: { in: [...defaultNames, ...optionalNames] } },
    });

    const defaultScopeIds = allScopes
      .filter((s) => defaultNames.includes(s.name))
      .map((s) => s.id);
    const optionalScopeIds = allScopes
      .filter((s) => optionalNames.includes(s.name))
      .map((s) => s.id);

    if (defaultScopeIds.length > 0) {
      await this.prisma.clientDefaultScope.createMany({
        data: defaultScopeIds.map((csId) => ({
          clientId: clientDbId,
          clientScopeId: csId,
        })),
      });
    }

    if (optionalScopeIds.length > 0) {
      await this.prisma.clientOptionalScope.createMany({
        data: optionalScopeIds.map((csId) => ({
          clientId: clientDbId,
          clientScopeId: csId,
        })),
      });
    }
  }
}
