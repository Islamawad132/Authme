import { Module, forwardRef } from '@nestjs/common';
import { StepUpService } from './step-up.service.js';
import { StepUpController } from './step-up.controller.js';
import { LoginModule } from '../login/login.module.js';

@Module({
  // LoginModule <-> OAuthModule is already a forwardRef pair.
  // StepUpModule is imported by OAuthModule which is imported by LoginModule,
  // so we must use forwardRef here to avoid a circular dependency error.
  imports: [forwardRef(() => LoginModule)],
  controllers: [StepUpController],
  providers: [StepUpService],
  exports: [StepUpService],
})
export class StepUpModule {}
