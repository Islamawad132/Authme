import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Realm, ClientType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
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
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
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
        grantTypes: dto.grantTypes ?? ['authorization_code'],
        requireConsent: dto.requireConsent ?? false,
      },
      select: CLIENT_SELECT,
    });

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
      },
      select: CLIENT_SELECT,
    });
  }

  async remove(realm: Realm, clientId: string) {
    await this.findByClientId(realm, clientId);
    await this.prisma.client.delete({
      where: {
        realmId_clientId: { realmId: realm.id, clientId },
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
}
