import { Controller, Post, Body, HttpCode, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';
import { KeycloakImporterService } from './keycloak-importer.service.js';
import { Auth0ImporterService } from './auth0-importer.service.js';
import type { MigrationReport } from './migration-report.js';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard.js';

class KeycloakImportDto {
  @IsObject()
  data!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsString()
  targetRealm?: string;
}

class Auth0ImportDto {
  @IsObject()
  data!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsString()
  targetRealm!: string;
}

@ApiTags('Migration')
@ApiSecurity('admin-api-key')
@UseGuards(AdminApiKeyGuard)
@Controller('admin/migration')
export class MigrationController {
  constructor(
    private readonly keycloakImporter: KeycloakImporterService,
    private readonly auth0Importer: Auth0ImporterService,
  ) {}

  @Post('keycloak')
  @HttpCode(200)
  @ApiOperation({ summary: 'Import from Keycloak realm export JSON' })
  @ApiResponse({ status: 200, description: 'Migration report with counts of imported/skipped entities' })
  @ApiResponse({ status: 400, description: 'Bad request — invalid payload or missing targetRealm' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid admin API key' })
  async importKeycloak(@Body() dto: KeycloakImportDto): Promise<MigrationReport> {
    return this.keycloakImporter.importRealm(dto.data, {
      dryRun: dto.dryRun ?? false,
      targetRealm: dto.targetRealm,
    });
  }

  @Post('auth0')
  @HttpCode(200)
  @ApiOperation({ summary: 'Import from Auth0 Management API export' })
  @ApiResponse({ status: 200, description: 'Migration report with counts of imported/skipped entities' })
  @ApiResponse({ status: 400, description: 'Bad request — invalid payload or missing targetRealm' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid admin API key' })
  async importAuth0(@Body() dto: Auth0ImportDto): Promise<MigrationReport> {
    return this.auth0Importer.importData(dto.data, {
      dryRun: dto.dryRun ?? false,
      targetRealm: dto.targetRealm,
    });
  }
}
