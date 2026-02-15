import { Module, forwardRef } from '@nestjs/common';
import { OAuthController } from './oauth.controller.js';
import { OAuthService } from './oauth.service.js';
import { LoginModule } from '../login/login.module.js';

@Module({
  imports: [forwardRef(() => LoginModule)],
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
