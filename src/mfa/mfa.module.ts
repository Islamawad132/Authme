import { Global, Module } from '@nestjs/common';
import { MfaService } from './mfa.service.js';

@Global()
@Module({
  providers: [MfaService],
  exports: [MfaService],
})
export class MfaModule {}
