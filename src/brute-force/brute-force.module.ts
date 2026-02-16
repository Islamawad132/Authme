import { Global, Module } from '@nestjs/common';
import { BruteForceService } from './brute-force.service.js';

@Global()
@Module({
  providers: [BruteForceService],
  exports: [BruteForceService],
})
export class BruteForceModule {}
