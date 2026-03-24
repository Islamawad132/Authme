import { Module } from '@nestjs/common';
import { WebAuthnService } from './webauthn.service.js';
import { WebAuthnController } from './webauthn.controller.js';
import { LoginModule } from '../login/login.module.js';
import { OAuthModule } from '../oauth/oauth.module.js';
import { ConsentModule } from '../consent/consent.module.js';

@Module({
  imports: [LoginModule, OAuthModule, ConsentModule],
  controllers: [WebAuthnController],
  providers: [WebAuthnService],
  exports: [WebAuthnService],
})
export class WebAuthnModule {}
