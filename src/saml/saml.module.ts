import { Module } from '@nestjs/common';
import { LoginModule } from '../login/login.module.js';
import { SamlIdpController } from './saml-idp.controller.js';
import { SamlSpAdminController } from './saml-sp-admin.controller.js';
import { SamlIdpService } from './saml-idp.service.js';
import { SamlMetadataService } from './saml-metadata.service.js';

@Module({
  imports: [LoginModule],
  controllers: [SamlIdpController, SamlSpAdminController],
  providers: [SamlIdpService, SamlMetadataService],
  exports: [SamlIdpService],
})
export class SamlModule {}
