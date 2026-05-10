import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Realm } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { CreateNhiIdentityDto } from './dto/create-nhi.dto.js';
import { UpdateNhiIdentityDto } from './dto/update-nhi.dto.js';
import { CreateNhiCredentialDto } from './dto/create-nhi-credential.dto.js';

// ── Select projections ────────────────────────────────────────────────────────

const NHI_IDENTITY_SELECT = {
  id: true,
  realmId: true,
  identityType: true,
  name: true,
  description: true,
  enabled: true,
  lifecycleStatus: true,
  suspendedAt: true,
  decommissionedAt: true,
  certificateSubject: true,
  certificateFingerprint: true,
  certificateNotBefore: true,
  certificateNotAfter: true,
  agentPurpose: true,
  permissionScopes: true,
  metadata: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
} as const;

const NHI_CREDENTIAL_SELECT = {
  id: true,
  nhiIdentityId: true,
  credentialType: true,
  name: true,
  keyPrefix: true,
  certificatePem: true,
  certificateChain: true,
  privateKeyPem: true,
  jwtSigningAlgorithm: true,
  jwtIssuer: true,
  jwtAudience: true,
  expiresAt: true,
  rotatedAt: true,
  rotationRequired: true,
  enabled: true,
  revoked: true,
  revokedAt: true,
  lastUsedAt: true,
  requestCount: true,
  allowedIpRanges: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class NhiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  // ── Identity CRUD ───────────────────────────────────────────────────────────

  async create(realm: Realm, dto: CreateNhiIdentityDto) {
    const existing = await this.prisma.nhiIdentity.findUnique({
      where: { realmId_name: { realmId: realm.id, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(
        `NHI identity '${dto.name}' already exists in realm '${realm.name}'`,
      );
    }

    return this.prisma.nhiIdentity.create({
      data: {
        realmId: realm.id,
        identityType: dto.identityType ?? 'MACHINE_TO_MACHINE',
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled ?? true,
        lifecycleStatus: dto.lifecycleStatus ?? 'PROVISIONING',
        agentPurpose: dto.agentPurpose,
        permissionScopes: dto.permissionScopes ?? [],
        metadata: dto.metadata ?? {},
        tags: dto.tags ?? [],
      },
      select: NHI_IDENTITY_SELECT,
    });
  }

  async findAll(realm: Realm) {
    return this.prisma.nhiIdentity.findMany({
      where: { realmId: realm.id },
      select: NHI_IDENTITY_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(realm: Realm, id: string) {
    const identity = await this.prisma.nhiIdentity.findFirst({
      where: { id, realmId: realm.id },
      select: NHI_IDENTITY_SELECT,
    });
    if (!identity) {
      throw new NotFoundException(`NHI identity '${id}' not found`);
    }
    return identity;
  }

  async update(realm: Realm, id: string, dto: UpdateNhiIdentityDto) {
    await this.findById(realm, id);

    if (dto.name) {
      const conflict = await this.prisma.nhiIdentity.findUnique({
        where: { realmId_name: { realmId: realm.id, name: dto.name } },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(
          `NHI identity name '${dto.name}' already taken in realm '${realm.name}'`,
        );
      }
    }

    return this.prisma.nhiIdentity.update({
      where: { id },
      data: {
        identityType: dto.identityType,
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled,
        lifecycleStatus: dto.lifecycleStatus,
        agentPurpose: dto.agentPurpose,
        permissionScopes: dto.permissionScopes,
        metadata: dto.metadata,
        tags: dto.tags,
        // Lifecycle management
        suspendedAt: dto.lifecycleStatus === 'SUSPENDED' ? new Date() : undefined,
        decommissionedAt: dto.lifecycleStatus === 'DECOMMISSIONED' ? new Date() : undefined,
      },
      select: NHI_IDENTITY_SELECT,
    });
  }

  async remove(realm: Realm, id: string) {
    await this.findById(realm, id);
    await this.prisma.nhiIdentity.delete({ where: { id } });
  }

  // ── Lifecycle operations ───────────────────────────────────────────────────

  async suspend(realm: Realm, id: string) {
    await this.findById(realm, id);
    return this.prisma.nhiIdentity.update({
      where: { id },
      data: { lifecycleStatus: 'SUSPENDED', suspendedAt: new Date() },
      select: NHI_IDENTITY_SELECT,
    });
  }

  async reactivate(realm: Realm, id: string) {
    const identity = await this.findById(realm, id);
    if (identity.lifecycleStatus !== 'SUSPENDED') {
      throw new ConflictException('Only suspended identities can be reactivated');
    }
    return this.prisma.nhiIdentity.update({
      where: { id },
      data: { lifecycleStatus: 'ACTIVE', suspendedAt: null },
      select: NHI_IDENTITY_SELECT,
    });
  }

  async decommission(realm: Realm, id: string) {
    await this.findById(realm, id);
    // Revoke all credentials first
    await this.prisma.nhiCredential.updateMany({
      where: { nhiIdentityId: id },
      data: { revoked: true, revokedAt: new Date() },
    });
    return this.prisma.nhiIdentity.update({
      where: { id },
      data: { lifecycleStatus: 'DECOMMISSIONED', decommissionedAt: new Date(), enabled: false },
      select: NHI_IDENTITY_SELECT,
    });
  }

  // ── Credential CRUD ─────────────────────────────────────────────────────────

  async createCredential(
    realm: Realm,
    nhiIdentityId: string,
    dto: CreateNhiCredentialDto,
  ) {
    await this.findById(realm, nhiIdentityId);

    // Generate API key if type is API_KEY
    let keyPrefix: string | undefined;
    let keyHash: string | undefined;
    let plainKey: string | undefined;

    if (dto.credentialType === 'API_KEY') {
      const rawKey = this.crypto.generateSecret(32); // 64 hex chars
      keyPrefix = rawKey.slice(0, 8);
      keyHash = await this.crypto.hashPassword(rawKey);
      plainKey = rawKey;
    }

    const credential = await this.prisma.nhiCredential.create({
      data: {
        nhiIdentityId,
        credentialType: dto.credentialType,
        name: dto.name,
        keyPrefix,
        keyHash,
        certificatePem: dto.certificatePem,
        certificateChain: dto.certificateChain,
        privateKeyPem: dto.privateKeyPem,
        jwtSigningAlgorithm: dto.jwtSigningAlgorithm,
        jwtIssuer: dto.jwtIssuer,
        jwtAudience: dto.jwtAudience,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        rotationRequired: dto.rotationRequired ?? false,
        enabled: dto.enabled ?? true,
        allowedIpRanges: dto.allowedIpRanges ?? [],
      },
      select: NHI_CREDENTIAL_SELECT,
    });

    return plainKey
      ? {
          ...credential,
          plainKey,
          keyWarning: 'Store this key securely. It will not be shown again.',
        }
      : credential;
  }

  async listCredentials(realm: Realm, nhiIdentityId: string) {
    await this.findById(realm, nhiIdentityId);
    return this.prisma.nhiCredential.findMany({
      where: { nhiIdentityId },
      select: NHI_CREDENTIAL_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findCredentialById(realm: Realm, nhiIdentityId: string, credentialId: string) {
    await this.findById(realm, nhiIdentityId);
    const credential = await this.prisma.nhiCredential.findFirst({
      where: { id: credentialId, nhiIdentityId },
      select: NHI_CREDENTIAL_SELECT,
    });
    if (!credential) {
      throw new NotFoundException(`Credential '${credentialId}' not found`);
    }
    return credential;
  }

  async revokeCredential(
    realm: Realm,
    nhiIdentityId: string,
    credentialId: string,
  ) {
    await this.findCredentialById(realm, nhiIdentityId, credentialId);
    const credential = await this.prisma.nhiCredential.findFirst({
      where: { id: credentialId, nhiIdentityId },
    });

    if (credential?.revoked) {
      return { message: 'Credential is already revoked' };
    }

    await this.prisma.nhiCredential.update({
      where: { id: credentialId },
      data: { revoked: true, revokedAt: new Date() },
    });

    return { message: 'Credential revoked successfully' };
  }

  async rotateCredential(
    realm: Realm,
    nhiIdentityId: string,
    credentialId: string,
  ) {
    await this.findCredentialById(realm, nhiIdentityId, credentialId);
    const oldCredential = await this.prisma.nhiCredential.findFirst({
      where: { id: credentialId, nhiIdentityId },
    });

    if (!oldCredential) {
      throw new NotFoundException(`Credential '${credentialId}' not found`);
    }

    if (oldCredential.credentialType !== 'API_KEY') {
      throw new ConflictException('Only API_KEY credentials can be rotated');
    }

    // Generate new key
    const newRaw = this.crypto.generateSecret(32);
    const newPrefix = newRaw.slice(0, 8);
    const newHash = await this.crypto.hashPassword(newRaw);

    // Create new credential
    const newCredential = await this.prisma.nhiCredential.create({
      data: {
        nhiIdentityId,
        credentialType: 'API_KEY',
        name: oldCredential.name ? `${oldCredential.name} (rotated)` : undefined,
        keyPrefix: newPrefix,
        keyHash: newHash,
        expiresAt: oldCredential.expiresAt,
        rotationRequired: false,
        enabled: true,
        allowedIpRanges: oldCredential.allowedIpRanges,
      },
      select: NHI_CREDENTIAL_SELECT,
    });

    // Revoke old credential
    await this.prisma.nhiCredential.update({
      where: { id: credentialId },
      data: { revoked: true, revokedAt: new Date() },
    });

    // Update old credential's rotatedAt
    await this.prisma.nhiCredential.update({
      where: { id: credentialId },
      data: { rotatedAt: new Date() },
    });

    return {
      newCredential: {
        ...newCredential,
        plainKey: newRaw,
        keyWarning: 'Store this key securely. It will not be shown again.',
      },
      oldCredentialId: credentialId,
    };
  }

  // ── Certificate management ─────────────────────────────────────────────────

  async setCertificate(
    realm: Realm,
    nhiIdentityId: string,
    certificatePem: string,
    privateKeyPem?: string,
    certificateChain?: string,
  ) {
    await this.findById(realm, nhiIdentityId);

    return this.prisma.nhiIdentity.update({
      where: { id: nhiIdentityId },
      data: {
        certificatePem,
        privateKeyPem,
        certificateChain,
        certificateNotBefore: undefined, // TODO: Parse from PEM if needed
        certificateNotAfter: undefined,
      },
      select: NHI_IDENTITY_SELECT,
    });
  }

  // ── Usage statistics ─────────────────────────────────────────────────────────

  async getUsageStats(realm: Realm, nhiIdentityId: string) {
    await this.findById(realm, nhiIdentityId);

    let stats = await this.prisma.nhiUsageStats.findUnique({
      where: { nhiIdentityId },
    });

    if (!stats) {
      // Create stats record if it doesn't exist
      stats = await this.prisma.nhiUsageStats.create({
        data: { nhiIdentityId },
      });
    }

    const credentials = await this.prisma.nhiCredential.findMany({
      where: { nhiIdentityId },
      select: {
        id: true,
        name: true,
        credentialType: true,
        expiresAt: true,
        lastUsedAt: true,
        requestCount: true,
        revoked: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalRequests = credentials.reduce((sum, c) => sum + c.requestCount, 0);

    return {
      nhiIdentityId,
      totalRequests,
      lastActiveAt: stats.lastActiveAt,
      credentials,
    };
  }
}
