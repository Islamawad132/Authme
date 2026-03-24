import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiSecurity, ApiTags, ApiOperation } from '@nestjs/swagger';
import { KeycloakImporterService } from './keycloak-importer.service.js';
import { Auth0ImporterService } from './auth0-importer.service.js';
import type { MigrationReport } from './migration-report.js';

class KeycloakImportDto {
  data: any;
  dryRun?: boolean;
  targetRealm?: string;
}

class Auth0ImportDto {
  data: any;
  dryRun?: boolean;
  targetRealm: string;
}

@ApiTags('Migration')
@ApiSecurity('admin-api-key')
@Controller('admin/migration')
export class MigrationController {
  constructor(
    private readonly keycloakImporter: KeycloakImporterService,
    private readonly auth0Importer: Auth0ImporterService,
  ) {}

  @Post('keycloak')
  @HttpCode(200)
  @ApiOperation({ summary: 'Import from Keycloak realm export JSON' })
  async importKeycloak(@Body() dto: KeycloakImportDto): Promise<MigrationReport> {
    return this.keycloakImporter.importRealm(dto.data, {
      dryRun: dto.dryRun ?? false,
      targetRealm: dto.targetRealm,
    });
  }

  @Post('auth0')
  @HttpCode(200)
  @ApiOperation({ summary: 'Import from Auth0 Management API export' })
  async importAuth0(@Body() dto: Auth0ImportDto): Promise<MigrationReport> {
    return this.auth0Importer.importData(dto.data, {
      dryRun: dto.dryRun ?? false,
      targetRealm: dto.targetRealm,
    });
  }
}
