import { Global, Module } from '@nestjs/common';
import { VerificationService } from './verification.service.js';

@Global()
@Module({
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
