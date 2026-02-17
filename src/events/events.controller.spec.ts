jest.mock('../crypto/jwk.service.js', () => ({ JwkService: jest.fn() }));

import { EventsController } from './events.controller.js';
import type { Realm } from '@prisma/client';

describe('EventsController', () => {
  let controller: EventsController;
  let mockEventsService: {
    queryLoginEvents: jest.Mock;
    clearLoginEvents: jest.Mock;
    queryAdminEvents: jest.Mock;
  };

  const realm = {
    id: 'realm-1',
    name: 'test-realm',
    enabled: true,
  } as Realm;

  beforeEach(() => {
    mockEventsService = {
      queryLoginEvents: jest.fn(),
      clearLoginEvents: jest.fn(),
      queryAdminEvents: jest.fn(),
    };

    controller = new EventsController(mockEventsService as any);
  });

  describe('getLoginEvents', () => {
    it('should call eventsService.queryLoginEvents with all params provided', () => {
      const expected = [{ id: 'event-1' }];
      mockEventsService.queryLoginEvents.mockReturnValue(expected);

      const result = controller.getLoginEvents(
        realm,
        'LOGIN',
        'user-1',
        'client-1',
        '2025-01-01',
        '2025-12-31',
        '0',
        '10',
      );

      expect(mockEventsService.queryLoginEvents).toHaveBeenCalledWith({
        realmId: 'realm-1',
        type: 'LOGIN',
        userId: 'user-1',
        clientId: 'client-1',
        dateFrom: new Date('2025-01-01'),
        dateTo: new Date('2025-12-31'),
        first: 0,
        max: 10,
      });
      expect(result).toEqual(expected);
    });

    it('should call eventsService.queryLoginEvents with no optional params', () => {
      const expected: unknown[] = [];
      mockEventsService.queryLoginEvents.mockReturnValue(expected);

      const result = controller.getLoginEvents(realm);

      expect(mockEventsService.queryLoginEvents).toHaveBeenCalledWith({
        realmId: 'realm-1',
        type: undefined,
        userId: undefined,
        clientId: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        first: undefined,
        max: undefined,
      });
      expect(result).toEqual(expected);
    });

    it('should parse date strings into Date objects', () => {
      controller.getLoginEvents(
        realm,
        undefined,
        undefined,
        undefined,
        '2025-06-15T10:30:00Z',
        '2025-06-16T10:30:00Z',
      );

      const call = mockEventsService.queryLoginEvents.mock.calls[0][0];
      expect(call.dateFrom).toEqual(new Date('2025-06-15T10:30:00Z'));
      expect(call.dateTo).toEqual(new Date('2025-06-16T10:30:00Z'));
    });

    it('should parse first and max as integers', () => {
      controller.getLoginEvents(
        realm,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '5',
        '25',
      );

      const call = mockEventsService.queryLoginEvents.mock.calls[0][0];
      expect(call.first).toBe(5);
      expect(call.max).toBe(25);
    });
  });

  describe('clearLoginEvents', () => {
    it('should call eventsService.clearLoginEvents with realm.id', () => {
      mockEventsService.clearLoginEvents.mockReturnValue(undefined);

      const result = controller.clearLoginEvents(realm);

      expect(mockEventsService.clearLoginEvents).toHaveBeenCalledWith('realm-1');
      expect(result).toBeUndefined();
    });
  });

  describe('getAdminEvents', () => {
    it('should call eventsService.queryAdminEvents with all params provided', () => {
      const expected = [{ id: 'admin-event-1' }];
      mockEventsService.queryAdminEvents.mockReturnValue(expected);

      const result = controller.getAdminEvents(
        realm,
        'CREATE',
        'USER',
        '2025-01-01',
        '2025-12-31',
        '0',
        '50',
      );

      expect(mockEventsService.queryAdminEvents).toHaveBeenCalledWith({
        realmId: 'realm-1',
        operationType: 'CREATE',
        resourceType: 'USER',
        dateFrom: new Date('2025-01-01'),
        dateTo: new Date('2025-12-31'),
        first: 0,
        max: 50,
      });
      expect(result).toEqual(expected);
    });

    it('should call eventsService.queryAdminEvents with no optional params', () => {
      const expected: unknown[] = [];
      mockEventsService.queryAdminEvents.mockReturnValue(expected);

      const result = controller.getAdminEvents(realm);

      expect(mockEventsService.queryAdminEvents).toHaveBeenCalledWith({
        realmId: 'realm-1',
        operationType: undefined,
        resourceType: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        first: undefined,
        max: undefined,
      });
      expect(result).toEqual(expected);
    });
  });
});
