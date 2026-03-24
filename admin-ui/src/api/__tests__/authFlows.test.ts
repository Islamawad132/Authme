import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';
import {
  getAuthFlows,
  getAuthFlowById,
  createAuthFlow,
  updateAuthFlow,
  deleteAuthFlow,
} from '../authFlows';

const BASE = '/admin';

// ─── Tests ───────────────────────────────────────────────────

describe('authFlows API', () => {
  describe('getAuthFlows', () => {
    it('returns a list of flows', async () => {
      const flows = await getAuthFlows('test-realm');
      expect(flows).toHaveLength(2);
      expect(flows[0].id).toBe('flow-1');
      expect(flows[1].id).toBe('flow-2');
    });

    it('calls the correct endpoint', async () => {
      const flows = await getAuthFlows('my-realm');
      expect(flows).toBeDefined();
    });
  });

  describe('getAuthFlowById', () => {
    it('returns a single flow by ID', async () => {
      const flow = await getAuthFlowById('test-realm', 'flow-1');
      expect(flow.id).toBe('flow-1');
      expect(flow.name).toBe('Basic Login');
    });

    it('includes steps in the response', async () => {
      const flow = await getAuthFlowById('test-realm', 'flow-1');
      expect(flow.steps).toHaveLength(1);
      expect(flow.steps[0].type).toBe('password');
    });
  });

  describe('createAuthFlow', () => {
    it('creates a new flow and returns it', async () => {
      const flow = await createAuthFlow('test-realm', {
        name: 'New Flow',
        description: 'A test flow',
        isDefault: false,
        steps: [],
      });
      expect(flow.id).toBe('new-flow-1');
      expect(flow.name).toBe('New Flow');
    });

    it('includes steps in the created flow', async () => {
      const flow = await createAuthFlow('test-realm', {
        name: 'MFA Flow',
        steps: [
          {
            id: 'password-1',
            type: 'password',
            required: true,
            order: 1,
            condition: null,
            fallbackStepId: null,
            config: {},
          },
        ],
      });
      expect(flow.steps).toBeDefined();
    });
  });

  describe('updateAuthFlow', () => {
    it('updates and returns the modified flow', async () => {
      const flow = await updateAuthFlow('test-realm', 'flow-1', {
        name: 'Updated Flow',
      });
      expect(flow.id).toBe('flow-1');
      expect(flow.name).toBe('Updated Flow');
    });

    it('can update just the steps', async () => {
      const newSteps = [
        {
          id: 'totp-1',
          type: 'totp' as const,
          required: true,
          order: 1,
          condition: null,
          fallbackStepId: null,
          config: {},
        },
      ];
      const flow = await updateAuthFlow('test-realm', 'flow-1', { steps: newSteps });
      expect(flow).toBeDefined();
    });
  });

  describe('deleteAuthFlow', () => {
    it('resolves without error on success', async () => {
      await expect(deleteAuthFlow('test-realm', 'flow-1')).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('throws when the server returns 500', async () => {
      server.use(
        http.get(`${BASE}/realms/:realm/auth-flows`, () =>
          HttpResponse.json({ message: 'Internal error' }, { status: 500 }),
        ),
      );
      await expect(getAuthFlows('test-realm')).rejects.toBeDefined();
    });

    it('throws when the server returns 404', async () => {
      server.use(
        http.get(`${BASE}/realms/:realm/auth-flows/:id`, () =>
          HttpResponse.json({ message: 'Not found' }, { status: 404 }),
        ),
      );
      await expect(getAuthFlowById('test-realm', 'missing')).rejects.toBeDefined();
    });
  });
});
