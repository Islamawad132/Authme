import { Global, Module } from '@nestjs/common';
import { BruteForceController } from './brute-force.controller.js';
import { BruteForceService } from './brute-force.service.js';

@Global()
@Module({
  controllers: [BruteForceController],
  providers: [BruteForceService],
  exports: [BruteForceService],
})
export class BruteForceModule {}
