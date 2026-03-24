import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Realm } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { CreateServiceAccountDto } from './dto/create-service-account.dto.js';
import { UpdateServiceAccountDto } from './dto/update-service-account.dto.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';

const SERVICE_ACCOUNT_SELECT = {
  id: true,
  realmId: true,
  name: true,
  description: true,
  enabled: true,
  createdAt: true,
  updatedAt: true,
} as const;

const API_KEY_SELECT = {
  id: true,
  serviceAccountId: true,
  keyPrefix: true,
  name: true,
  scopes: true,
  expiresAt: true,
  lastUsedAt: true,
  requestCount: true,
  revoked: true,
  revokedAt: true,
  createdAt: true,
} as const;

// Grace period (seconds) during which a rotated-out key keeps working
const ROTATION_GRACE_SECONDS = 3600;

@Injectable()
export class ServiceAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  // ── Service Account CRUD ───────────────────────────────────────────────────

  async create(realm: Realm, dto: CreateServiceAccountDto) {
    const existing = await this.prisma.serviceAccount.findUnique({
      where: { realmId_name: { realmId: realm.id, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(
        `Service account '${dto.name}' already exists in realm '${realm.name}'`,
      );
    }

    return this.prisma.serviceAccount.create({
      data: {
        realmId: realm.id,
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled ?? true,
      },
      select: SERVICE_ACCOUNT_SELECT,
    });
  }

  async findAll(realm: Realm) {
    return this.prisma.serviceAccount.findMany({
      where: { realmId: realm.id },
      select: SERVICE_ACCOUNT_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(realm: Realm, id: string) {
    const sa = await this.prisma.serviceAccount.findFirst({
      where: { id, realmId: realm.id },
      select: SERVICE_ACCOUNT_SELECT,
    });
    if (!sa) {
      throw new NotFoundException(`Service account '${id}' not found`);
    }
    return sa;
  }

  async update(realm: Realm, id: string, dto: UpdateServiceAccountDto) {
    await this.findById(realm, id);

    if (dto.name) {
      const conflict = await this.prisma.serviceAccount.findUnique({
        where: { realmId_name: { realmId: realm.id, name: dto.name } },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(
          `Service account name '${dto.name}' already taken in realm '${realm.name}'`,
        );
      }
    }

    return this.prisma.serviceAccount.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled,
      },
      select: SERVICE_ACCOUNT_SELECT,
    });
  }

  async remove(realm: Realm, id: string) {
    await this.findById(realm, id);
    await this.prisma.serviceAccount.delete({ where: { id } });
  }

  // ── API Key management ─────────────────────────────────────────────────────

  async createApiKey(realm: Realm, serviceAccountId: string, dto: CreateApiKeyDto) {
    await this.findById(realm, serviceAccountId);

    // Generate a cryptographically random key: prefix (8 hex chars) + full key (64 hex chars)
    const rawKey = this.crypto.generateSecret(32); // 64 hex chars
    const keyPrefix = rawKey.slice(0, 8);
    const keyHash = await this.crypto.hashPassword(rawKey);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        serviceAccountId,
        keyPrefix,
        keyHash,
        name: dto.name,
        scopes: dto.scopes ?? [],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      select: API_KEY_SELECT,
    });

    return {
      ...apiKey,
      plainKey: rawKey,
      keyWarning: 'Store this key securely. It will not be shown again.',
    };
  }

  async listApiKeys(realm: Realm, serviceAccountId: string) {
    await this.findById(realm, serviceAccountId);
    return this.prisma.apiKey.findMany({
      where: { serviceAccountId },
      select: API_KEY_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async revokeApiKey(realm: Realm, serviceAccountId: string, apiKeyId: string) {
    await this.findById(realm, serviceAccountId);
    const key = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, serviceAccountId },
    });
    if (!key) {
      throw new NotFoundException(`API key '${apiKeyId}' not found`);
    }
    if (key.revoked) {
      return { message: 'API key is already revoked' };
    }

    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revoked: true, revokedAt: new Date() },
    });

    return { message: 'API key revoked successfully' };
  }

  async rotateApiKey(realm: Realm, serviceAccountId: string, apiKeyId: string) {
    await this.findById(realm, serviceAccountId);
    const oldKey = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, serviceAccountId },
    });
    if (!oldKey) {
      throw new NotFoundException(`API key '${apiKeyId}' not found`);
    }

    // Create a new key with the same settings
    const newRaw = this.crypto.generateSecret(32);
    const newPrefix = newRaw.slice(0, 8);
    const newHash = await this.crypto.hashPassword(newRaw);

    const newKey = await this.prisma.apiKey.create({
      data: {
        serviceAccountId,
        keyPrefix: newPrefix,
        keyHash: newHash,
        name: oldKey.name ? `${oldKey.name} (rotated)` : undefined,
        scopes: oldKey.scopes,
        expiresAt: oldKey.expiresAt,
      },
      select: API_KEY_SELECT,
    });

    // Schedule old key for expiry after grace period (mark via expiresAt)
    const graceExpiry = new Date(Date.now() + ROTATION_GRACE_SECONDS * 1000);
    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { expiresAt: graceExpiry },
    });

    return {
      newKey: {
        ...newKey,
        plainKey: newRaw,
        keyWarning: 'Store this key securely. It will not be shown again.',
      },
      oldKeyId: apiKeyId,
      gracePeriodEndsAt: graceExpiry,
    };
  }

  async validateApiKey(keyPrefix: string, plainKey: string) {
    const candidates = await this.prisma.apiKey.findMany({
      where: { keyPrefix, revoked: false },
      include: { serviceAccount: true },
    });

    for (const candidate of candidates) {
      // Skip expired keys
      if (candidate.expiresAt && candidate.expiresAt < new Date()) continue;
      // Skip disabled service accounts
      if (!candidate.serviceAccount.enabled) continue;

      const valid = await this.crypto.verifyPassword(candidate.keyHash, plainKey);
      if (valid) {
        // Update usage statistics (fire-and-forget — don't block the request)
        this.prisma.apiKey
          .update({
            where: { id: candidate.id },
            data: {
              lastUsedAt: new Date(),
              requestCount: { increment: 1 },
            },
          })
          .catch(() => {
            // Non-critical — ignore failures
          });

        return candidate;
      }
    }

    throw new UnauthorizedException('Invalid or expired API key');
  }

  async getUsageMetrics(realm: Realm, serviceAccountId: string) {
    await this.findById(realm, serviceAccountId);

    const keys = await this.prisma.apiKey.findMany({
      where: { serviceAccountId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        revoked: true,
        expiresAt: true,
        lastUsedAt: true,
        requestCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalRequests = keys.reduce((sum, k) => sum + k.requestCount, 0);
    const lastUsedAt = keys
      .filter((k) => k.lastUsedAt !== null)
      .sort((a, b) =>
        (b.lastUsedAt as Date).getTime() - (a.lastUsedAt as Date).getTime(),
      )[0]?.lastUsedAt ?? null;

    return {
      serviceAccountId,
      totalRequests,
      lastUsedAt,
      keys,
    };
  }
}
