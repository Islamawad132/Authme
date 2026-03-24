import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service.js';

describe('RedisService', () => {
  let service: RedisService;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env['REDIS_URL'];

    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisService],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  afterEach(async () => {
    process.env = originalEnv;
    // Trigger onModuleDestroy to clean up any open handles
    await service.onModuleDestroy();
  });

  describe('when REDIS_URL is not set', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('isAvailable() should return false', () => {
      service.onModuleInit();
      expect(service.isAvailable()).toBe(false);
    });

    it('get() should return null', async () => {
      service.onModuleInit();
      expect(await service.get('any-key')).toBeNull();
    });

    it('set() should not throw', async () => {
      service.onModuleInit();
      await expect(service.set('key', 'val', 60)).resolves.not.toThrow();
    });

    it('del() should not throw', async () => {
      service.onModuleInit();
      await expect(service.del('key')).resolves.not.toThrow();
    });

    it('exists() should return false', async () => {
      service.onModuleInit();
      expect(await service.exists('key')).toBe(false);
    });

    it('ping() should return false', async () => {
      service.onModuleInit();
      expect(await service.ping()).toBe(false);
    });

    it('delPattern() should not throw', async () => {
      service.onModuleInit();
      await expect(service.delPattern('realm:*')).resolves.not.toThrow();
    });
  });
});
