import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginEventTypeValue, OperationTypeValue, ResourceTypeValue } from './event-types.js';

export interface RecordLoginEventParams {
  realmId: string;
  userId?: string;
  sessionId?: string;
  type: LoginEventTypeValue;
  clientId?: string;
  ipAddress?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface RecordAdminEventParams {
  realmId: string;
  adminUserId: string;
  operationType: OperationTypeValue;
  resourceType: ResourceTypeValue;
  resourcePath: string;
  representation?: Record<string, unknown>;
  ipAddress?: string;
}

export interface QueryEventsParams {
  realmId: string;
  type?: string;
  userId?: string;
  clientId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  first?: number;
  max?: number;
}

export interface QueryAdminEventsParams {
  realmId: string;
  operationType?: string;
  resourceType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  first?: number;
  max?: number;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordLoginEvent(params: RecordLoginEventParams): Promise<void> {
    const realm = await this.prisma.realm.findUnique({
      where: { id: params.realmId },
      select: { eventsEnabled: true },
    });
    if (!realm?.eventsEnabled) return;

    try {
      await this.prisma.loginEvent.create({
        data: {
          realmId: params.realmId,
          userId: params.userId,
          sessionId: params.sessionId,
          type: params.type,
          clientId: params.clientId,
          ipAddress: params.ipAddress,
          error: params.error,
          details: (params.details as any) ?? undefined,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to record login event: ${(err as Error).message}`);
    }
  }

  async recordAdminEvent(params: RecordAdminEventParams): Promise<void> {
    const realm = await this.prisma.realm.findUnique({
      where: { id: params.realmId },
      select: { adminEventsEnabled: true },
    });
    if (!realm?.adminEventsEnabled) return;

    try {
      await this.prisma.adminEvent.create({
        data: {
          realmId: params.realmId,
          adminUserId: params.adminUserId,
          operationType: params.operationType,
          resourceType: params.resourceType,
          resourcePath: params.resourcePath,
          representation: (params.representation as any) ?? undefined,
          ipAddress: params.ipAddress,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to record admin event: ${(err as Error).message}`);
    }
  }

  async queryLoginEvents(params: QueryEventsParams) {
    const where: any = { realmId: params.realmId };
    if (params.type) where.type = params.type;
    if (params.userId) where.userId = params.userId;
    if (params.clientId) where.clientId = params.clientId;
    if (params.dateFrom || params.dateTo) {
      where.createdAt = {};
      if (params.dateFrom) where.createdAt.gte = params.dateFrom;
      if (params.dateTo) where.createdAt.lte = params.dateTo;
    }

    return this.prisma.loginEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: params.first ?? 0,
      take: params.max ?? 100,
    });
  }

  async queryAdminEvents(params: QueryAdminEventsParams) {
    const where: any = { realmId: params.realmId };
    if (params.operationType) where.operationType = params.operationType;
    if (params.resourceType) where.resourceType = params.resourceType;
    if (params.dateFrom || params.dateTo) {
      where.createdAt = {};
      if (params.dateFrom) where.createdAt.gte = params.dateFrom;
      if (params.dateTo) where.createdAt.lte = params.dateTo;
    }

    return this.prisma.adminEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: params.first ?? 0,
      take: params.max ?? 100,
    });
  }

  async clearLoginEvents(realmId: string): Promise<void> {
    await this.prisma.loginEvent.deleteMany({ where: { realmId } });
  }

  async clearAdminEvents(realmId: string): Promise<void> {
    await this.prisma.adminEvent.deleteMany({ where: { realmId } });
  }
}
