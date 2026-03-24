import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import type { Realm } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateWebhookDto, UpdateWebhookDto } from './webhooks.dto.js';

export interface DispatchEventOptions {
  realmId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

const WEBHOOK_SELECT = {
  id: true,
  realmId: true,
  url: true,
  enabled: true,
  eventTypes: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Retry delays in milliseconds: 1s, 10s, 60s */
const RETRY_DELAYS_MS = [1_000, 10_000, 60_000];

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── CRUD ──────────────────────────────────────────────

  async create(realm: Realm, dto: CreateWebhookDto) {
    const webhook = await this.prisma.webhook.create({
      data: {
        realmId: realm.id,
        url: dto.url,
        secret: dto.secret,
        enabled: dto.enabled ?? true,
        eventTypes: dto.eventTypes,
        description: dto.description,
      },
      select: WEBHOOK_SELECT,
    });
    return webhook;
  }

  async findAll(realm: Realm) {
    return this.prisma.webhook.findMany({
      where: { realmId: realm.id },
      select: WEBHOOK_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(realm: Realm, id: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id, realmId: realm.id },
      select: WEBHOOK_SELECT,
    });
    if (!webhook) {
      throw new NotFoundException(`Webhook '${id}' not found`);
    }
    return webhook;
  }

  async update(realm: Realm, id: string, dto: UpdateWebhookDto) {
    await this.findOne(realm, id);
    return this.prisma.webhook.update({
      where: { id },
      data: {
        url: dto.url,
        secret: dto.secret,
        enabled: dto.enabled,
        eventTypes: dto.eventTypes,
        description: dto.description,
      },
      select: WEBHOOK_SELECT,
    });
  }

  async remove(realm: Realm, id: string) {
    await this.findOne(realm, id);
    await this.prisma.webhook.delete({ where: { id } });
  }

  // ─── Test Webhook ───────────────────────────────────────

  async testWebhook(realm: Realm, id: string) {
    const webhook = await this.findOne(realm, id);
    const rawWebhook = await this.prisma.webhook.findFirst({
      where: { id, realmId: realm.id },
    });
    if (!rawWebhook) {
      throw new NotFoundException(`Webhook '${id}' not found`);
    }
    const testPayload = {
      eventType: 'webhook.test',
      timestamp: new Date().toISOString(),
      realmId: realm.id,
      webhookId: id,
      test: true,
    };
    const delivery = await this.deliverWebhook(rawWebhook, 'webhook.test', testPayload);
    return { message: 'Test event sent', delivery };
  }

  // ─── Delivery Logs ─────────────────────────────────────

  async findDeliveries(realm: Realm, webhookId: string) {
    await this.findOne(realm, webhookId);
    return this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ─── Event Dispatch ────────────────────────────────────

  /**
   * Dispatch an event to all matching webhooks for the realm.
   * Non-blocking: schedules delivery asynchronously.
   */
  dispatchEvent(options: DispatchEventOptions): void {
    // Fire-and-forget — never block the caller
    setImmediate(() => {
      this.doDispatch(options).catch((err) => {
        this.logger.warn(
          `dispatchEvent error for realm=${options.realmId} type=${options.eventType}: ${(err as Error).message}`,
        );
      });
    });
  }

  private async doDispatch(options: DispatchEventOptions): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        realmId: options.realmId,
        enabled: true,
        eventTypes: { has: options.eventType },
      },
    });

    if (webhooks.length === 0) return;

    const fullPayload = {
      eventType: options.eventType,
      timestamp: new Date().toISOString(),
      realmId: options.realmId,
      ...options.payload,
    };

    await Promise.allSettled(
      webhooks.map((webhook) =>
        this.deliverWebhook(webhook, options.eventType, fullPayload),
      ),
    );
  }

  // ─── Delivery with Retry ───────────────────────────────

  private async deliverWebhook(
    webhook: { id: string; url: string; secret: string },
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const body = JSON.stringify(payload);
    const signature = this.signPayload(webhook.secret, body);

    // Create initial delivery record
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        eventType,
        payload: payload as any,
        attempts: 0,
      },
    });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        const delay = RETRY_DELAYS_MS[attempt - 1];
        await this.sleep(delay);
      }

      try {
        const response = await this.doHttpPost(webhook.url, body, signature);

        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            statusCode: response.statusCode,
            response: response.body.slice(0, 2000),
            success: response.statusCode >= 200 && response.statusCode < 300,
            attempts: attempt + 1,
            lastAttempt: new Date(),
          },
        });

        if (response.statusCode >= 200 && response.statusCode < 300) {
          return { ...delivery, success: true, attempts: attempt + 1 };
        }

        lastError = new Error(`HTTP ${response.statusCode}`);
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(
          `Webhook delivery attempt ${attempt + 1} failed for ${webhook.url}: ${lastError.message}`,
        );
      }
    }

    // All attempts exhausted
    await this.prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        success: false,
        attempts: RETRY_DELAYS_MS.length + 1,
        lastAttempt: new Date(),
        response: lastError?.message?.slice(0, 2000),
      },
    });

    return { ...delivery, success: false };
  }

  // ─── HMAC-SHA256 Signing ───────────────────────────────

  signPayload(secret: string, body: string): string {
    return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  }

  // ─── HTTP POST ─────────────────────────────────────────

  private async doHttpPost(
    url: string,
    body: string,
    signature: string,
  ): Promise<{ statusCode: number; body: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': new Date().toISOString(),
          'User-Agent': 'Authme-Webhook/1.0',
        },
        body,
        signal: controller.signal,
      });

      const text = await res.text();
      return { statusCode: res.status, body: text };
    } finally {
      clearTimeout(timeout);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
