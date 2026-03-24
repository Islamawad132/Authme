import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CustomAttributesModule } from '../custom-attributes/custom-attributes.module.js';

@Module({
  imports: [CustomAttributesModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
