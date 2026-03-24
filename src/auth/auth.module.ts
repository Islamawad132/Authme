import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CustomAttributesModule } from '../custom-attributes/custom-attributes.module.js';
import { StepUpModule } from '../step-up/step-up.module.js';

@Module({
  imports: [CustomAttributesModule, StepUpModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
