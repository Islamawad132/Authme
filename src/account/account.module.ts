import { Module } from '@nestjs/common';
import { AccountController } from './account.controller.js';
import { LoginModule } from '../login/login.module.js';
import { ThemeModule } from '../theme/theme.module.js';
import { WebAuthnModule } from '../webauthn/webauthn.module.js';

@Module({
  imports: [LoginModule, ThemeModule, WebAuthnModule],
  controllers: [AccountController],
})
export class AccountModule {}
