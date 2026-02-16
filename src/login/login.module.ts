import { Module, forwardRef } from '@nestjs/common';
import { LoginController } from './login.controller.js';
import { LoginService } from './login.service.js';
import { OAuthModule } from '../oauth/oauth.module.js';
import { UserFederationModule } from '../user-federation/user-federation.module.js';
import { ThemeModule } from '../theme/theme.module.js';

@Module({
  imports: [forwardRef(() => OAuthModule), UserFederationModule, ThemeModule],
  controllers: [LoginController],
  providers: [LoginService],
  exports: [LoginService],
})
export class LoginModule {}
