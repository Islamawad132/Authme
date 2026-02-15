import { Module } from '@nestjs/common';
import { AccountController } from './account.controller.js';
import { LoginModule } from '../login/login.module.js';

@Module({
  imports: [LoginModule],
  controllers: [AccountController],
})
export class AccountModule {}
