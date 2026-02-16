jest.mock('../crypto/jwk.service.js', () => ({ JwkService: jest.fn() }));

import { MetricsService } from './metrics.service.js';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('should instantiate without errors', () => {
    expect(service).toBeDefined();
  });

  it('should expose a registry that returns prometheus text', async () => {
    const text = await service.registry.metrics();
    expect(typeof text).toBe('string');
    expect(text).toContain('http_requests_total');
  });

  it('should have authLoginTotal counter', () => {
    expect(service.authLoginTotal).toBeDefined();
    service.authLoginTotal.inc({ realm: 'test', status: 'success' });
  });

  it('should have authTokenIssuedTotal counter', () => {
    expect(service.authTokenIssuedTotal).toBeDefined();
    service.authTokenIssuedTotal.inc({ realm: 'test', grant_type: 'password' });
  });

  it('should have activeSessionsTotal gauge', () => {
    expect(service.activeSessionsTotal).toBeDefined();
    service.activeSessionsTotal.inc({ realm: 'test' });
    service.activeSessionsTotal.dec({ realm: 'test' });
  });
});
