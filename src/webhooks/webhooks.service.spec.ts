// Mock fetch globally before imports
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

import { NotFoundException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service.js';
import {
  createMockPrismaService,
  MockPrismaService,
} from '../prisma/prisma.mock.js';
import type { Realm } from '@prisma/client';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let prisma: MockPrismaService;

  const mockRealm: Realm = {
    id: 'realm-1',
    name: 'test-realm',
    displayName: 'Test Realm',
    enabled: true,
  } as Realm;

  const mockWebhook = {
    id: 'webhook-1',
    realmId: 'realm-1',
    url: 'https://example.com/hook',
    secret: 'super-secret-key',
    enabled: true,
    eventTypes: ['user.login', 'user.created'],
    description: 'Test webhook',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new WebhooksService(prisma as any);
    jest.clearAllMocks();
  });

  // ─── HMAC Signing ─────────────────────────────────────

  describe('signPayload', () => {
    it('should produce a sha256= prefixed HMAC signature', () => {
      const secret = 'my-secret';
      const body = '{"eventType":"user.login"}';
      const sig = service.signPayload(secret, body);

      expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it('should produce consistent signatures for the same input', () => {
      const secret = 'consistent-secret';
      const body = '{"hello":"world"}';

      const sig1 = service.signPayload(secret, body);
      const sig2 = service.signPayload(secret, body);

      expect(sig1).toBe(sig2);
    });

    it('should produce different signatures for different secrets', () => {
      const body = '{"hello":"world"}';

      const sig1 = service.signPayload('secret-a', body);
      const sig2 = service.signPayload('secret-b', body);

      expect(sig1).not.toBe(sig2);
    });

    it('should produce different signatures for different payloads', () => {
      const secret = 'same-secret';

      const sig1 = service.signPayload(secret, '{"a":1}');
      const sig2 = service.signPayload(secret, '{"a":2}');

      expect(sig1).not.toBe(sig2);
    });
  });

  // ─── CRUD ──────────────────────────────────────────────

  describe('create', () => {
    it('should create a webhook', async () => {
      prisma.webhook.create.mockResolvedValue(mockWebhook);

      const dto = {
        url: 'https://example.com/hook',
        secret: 'super-secret-key',
        eventTypes: ['user.login'],
        enabled: true,
      };

      const result = await service.create(mockRealm, dto);

      expect(prisma.webhook.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            realmId: 'realm-1',
            url: dto.url,
            secret: dto.secret,
            eventTypes: dto.eventTypes,
          }),
        }),
      );
      expect(result).toEqual(mockWebhook);
    });

    it('should default enabled to true when not specified', async () => {
      prisma.webhook.create.mockResolvedValue(mockWebhook);

      await service.create(mockRealm, {
        url: 'https://example.com/hook',
        secret: 'super-secret-key',
        eventTypes: ['user.login'],
      });

      expect(prisma.webhook.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ enabled: true }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all webhooks for a realm', async () => {
      const webhooks = [mockWebhook];
      prisma.webhook.findMany.mockResolvedValue(webhooks);

      const result = await service.findAll(mockRealm);

      expect(result).toEqual(webhooks);
      expect(prisma.webhook.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { realmId: 'realm-1' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return webhook when found', async () => {
      prisma.webhook.findFirst.mockResolvedValue(mockWebhook);

      const result = await service.findOne(mockRealm, 'webhook-1');

      expect(result).toEqual(mockWebhook);
      expect(prisma.webhook.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'webhook-1', realmId: 'realm-1' },
        }),
      );
    });

    it('should throw NotFoundException when webhook not found', async () => {
      prisma.webhook.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockRealm, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a webhook', async () => {
      const updated = { ...mockWebhook, enabled: false };
      prisma.webhook.findFirst.mockResolvedValue(mockWebhook);
      prisma.webhook.update.mockResolvedValue(updated);

      const result = await service.update(mockRealm, 'webhook-1', {
        enabled: false,
      });

      expect(result).toEqual(updated);
      expect(prisma.webhook.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'webhook-1' },
          data: expect.objectContaining({ enabled: false }),
        }),
      );
    });

    it('should throw NotFoundException when webhook not found', async () => {
      prisma.webhook.findFirst.mockResolvedValue(null);

      await expect(
        service.update(mockRealm, 'missing', { enabled: false }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a webhook', async () => {
      prisma.webhook.findFirst.mockResolvedValue(mockWebhook);
      prisma.webhook.delete.mockResolvedValue(mockWebhook);

      await service.remove(mockRealm, 'webhook-1');

      expect(prisma.webhook.delete).toHaveBeenCalledWith({
        where: { id: 'webhook-1' },
      });
    });

    it('should throw NotFoundException when webhook not found', async () => {
      prisma.webhook.findFirst.mockResolvedValue(null);

      await expect(service.remove(mockRealm, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Dispatch ──────────────────────────────────────────

  describe('dispatchEvent', () => {
    it('should not throw when dispatch succeeds', () => {
      prisma.webhook.findMany.mockResolvedValue([]);

      // dispatchEvent is fire-and-forget, should not throw
      expect(() =>
        service.dispatchEvent({
          realmId: 'realm-1',
          eventType: 'user.login',
          payload: { userId: 'user-1' },
        }),
      ).not.toThrow();
    });

    it('should find enabled webhooks with matching eventType', async () => {
      prisma.webhook.findMany.mockResolvedValue([]);

      // Trigger internal dispatch directly
      await (service as any).doDispatch({
        realmId: 'realm-1',
        eventType: 'user.login',
        payload: { userId: 'user-1' },
      });

      expect(prisma.webhook.findMany).toHaveBeenCalledWith({
        where: {
          realmId: 'realm-1',
          enabled: true,
          eventTypes: { has: 'user.login' },
        },
      });
    });

    it('should not deliver when no matching webhooks', async () => {
      prisma.webhook.findMany.mockResolvedValue([]);

      await (service as any).doDispatch({
        realmId: 'realm-1',
        eventType: 'user.login',
        payload: {},
      });

      expect(prisma.webhookDelivery.create).not.toHaveBeenCalled();
    });
  });

  // ─── Retry Logic ───────────────────────────────────────

  describe('deliverWebhook (retry logic)', () => {
    const webhookRecord = {
      id: 'webhook-1',
      url: 'https://example.com/hook',
      secret: 'test-secret',
    };

    beforeEach(() => {
      jest.useFakeTimers();
      prisma.webhookDelivery.create.mockResolvedValue({ id: 'delivery-1' });
      prisma.webhookDelivery.update.mockResolvedValue({});
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should succeed on first attempt', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        text: async () => 'OK',
      });

      const promise = (service as any).deliverWebhook(
        webhookRecord,
        'user.login',
        { userId: 'u1' },
      );
      // Fast-forward any timers
      jest.runAllTimersAsync();

      await promise;

      expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ success: true, attempts: 1 }),
        }),
      );
    });

    it('should retry on failure and eventually mark as failed', async () => {
      // Fail all 4 attempts (initial + 3 retries)
      mockFetch
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'));

      // Replace sleep to avoid waiting
      jest
        .spyOn(service as any, 'sleep')
        .mockResolvedValue(undefined);

      await (service as any).deliverWebhook(webhookRecord, 'user.login', {});

      // Should have tried 4 times (1 + 3 retries)
      expect(mockFetch).toHaveBeenCalledTimes(4);

      expect(prisma.webhookDelivery.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ success: false }),
        }),
      );
    });

    it('should succeed on retry after initial failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          status: 200,
          text: async () => 'OK',
        });

      jest
        .spyOn(service as any, 'sleep')
        .mockResolvedValue(undefined);

      await (service as any).deliverWebhook(webhookRecord, 'user.login', {});

      expect(mockFetch).toHaveBeenCalledTimes(2);

      expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ success: true, attempts: 2 }),
        }),
      );
    });

    it('should mark as failed when endpoint returns non-2xx and all retries exhausted', async () => {
      mockFetch.mockResolvedValue({
        status: 500,
        text: async () => 'Internal Server Error',
      });

      jest
        .spyOn(service as any, 'sleep')
        .mockResolvedValue(undefined);

      await (service as any).deliverWebhook(webhookRecord, 'user.login', {});

      // Called 4 times: initial + 3 retries
      expect(mockFetch).toHaveBeenCalledTimes(4);

      // The final update should mark it as failed
      expect(prisma.webhookDelivery.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ success: false }),
        }),
      );
    });

    it('should include HMAC signature header in request', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        text: async () => 'OK',
      });

      jest
        .spyOn(service as any, 'sleep')
        .mockResolvedValue(undefined);

      await (service as any).deliverWebhook(
        webhookRecord,
        'user.login',
        { userId: 'u1' },
      );

      expect(mockFetch).toHaveBeenCalledWith(
        webhookRecord.url,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Webhook-Signature': expect.stringMatching(/^sha256=[a-f0-9]{64}$/),
          }),
        }),
      );
    });
  });

  // ─── findDeliveries ────────────────────────────────────

  describe('findDeliveries', () => {
    it('should return delivery logs for a webhook', async () => {
      const deliveries = [
        { id: 'del-1', webhookId: 'webhook-1', eventType: 'user.login' },
      ];
      prisma.webhook.findFirst.mockResolvedValue(mockWebhook);
      prisma.webhookDelivery.findMany.mockResolvedValue(deliveries);

      const result = await service.findDeliveries(mockRealm, 'webhook-1');

      expect(result).toEqual(deliveries);
      expect(prisma.webhookDelivery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { webhookId: 'webhook-1' } }),
      );
    });

    it('should throw NotFoundException when webhook not found', async () => {
      prisma.webhook.findFirst.mockResolvedValue(null);

      await expect(
        service.findDeliveries(mockRealm, 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
