import { Global, Module } from '@nestjs/common';
import { MfaService } from './mfa.service.js';
import { MfaController } from './mfa.controller.js';
import { StepUpModule } from '../step-up/step-up.module.js';
import { forwardRef } from '@nestjs/common';
import { LoginModule } from '../login/login.module.js';

@Global()
@Module({
  controllers: [MfaController],
  imports: [StepUpModule, forwardRef(() => LoginModule)],
  providers: [MfaService],
  exports: [MfaService],
})
export class MfaModule {}
