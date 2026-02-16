import { Module } from '@nestjs/common';
import { AccountController } from './account.controller.js';
import { LoginModule } from '../login/login.module.js';
import { ThemeModule } from '../theme/theme.module.js';

@Module({
  imports: [LoginModule, ThemeModule],
  controllers: [AccountController],
})
export class AccountModule {}
