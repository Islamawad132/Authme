import { Module, forwardRef } from '@nestjs/common';
import { LoginController } from './login.controller.js';
import { LoginService } from './login.service.js';
import { OAuthModule } from '../oauth/oauth.module.js';

@Module({
  imports: [forwardRef(() => OAuthModule)],
  controllers: [LoginController],
  providers: [LoginService],
  exports: [LoginService],
})
export class LoginModule {}
