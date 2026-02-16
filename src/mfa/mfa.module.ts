import { Global, Module } from '@nestjs/common';
import { MfaService } from './mfa.service.js';
import { MfaController } from './mfa.controller.js';

@Global()
@Module({
  controllers: [MfaController],
  providers: [MfaService],
  exports: [MfaService],
})
export class MfaModule {}
