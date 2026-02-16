import { Module, forwardRef } from '@nestjs/common';
import { LoginController } from './login.controller.js';
import { LoginService } from './login.service.js';
import { ThemeService } from './theme.service.js';
import { OAuthModule } from '../oauth/oauth.module.js';
import { UserFederationModule } from '../user-federation/user-federation.module.js';

@Module({
  imports: [forwardRef(() => OAuthModule), UserFederationModule],
  controllers: [LoginController],
  providers: [LoginService, ThemeService],
  exports: [LoginService, ThemeService],
})
export class LoginModule {}
