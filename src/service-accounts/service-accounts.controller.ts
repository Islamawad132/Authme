import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import type { Realm } from '@prisma/client';
import { ServiceAccountsService } from './service-accounts.service.js';
import { CreateServiceAccountDto } from './dto/create-service-account.dto.js';
import { UpdateServiceAccountDto } from './dto/update-service-account.dto.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';

@ApiTags('Service Accounts')
@Controller('admin/realms/:realmName/service-accounts')
@UseGuards(RealmGuard)
@ApiSecurity('admin-api-key')
export class ServiceAccountsController {
  constructor(private readonly serviceAccountsService: ServiceAccountsService) {}

  // ── Service Account endpoints ──────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a service account in a realm' })
  create(@CurrentRealm() realm: Realm, @Body() dto: CreateServiceAccountDto) {
    return this.serviceAccountsService.create(realm, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List service accounts in a realm' })
  findAll(@CurrentRealm() realm: Realm) {
    return this.serviceAccountsService.findAll(realm);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a service account by ID' })
  findOne(@CurrentRealm() realm: Realm, @Param('id') id: string) {
    return this.serviceAccountsService.findById(realm, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a service account' })
  update(
    @CurrentRealm() realm: Realm,
    @Param('id') id: string,
    @Body() dto: UpdateServiceAccountDto,
  ) {
    return this.serviceAccountsService.update(realm, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a service account' })
  remove(@CurrentRealm() realm: Realm, @Param('id') id: string) {
    return this.serviceAccountsService.remove(realm, id);
  }

  // ── API Key endpoints ──────────────────────────────────────────────────────

  @Post(':id/api-keys')
  @ApiOperation({ summary: 'Create an API key for a service account' })
  createApiKey(
    @CurrentRealm() realm: Realm,
    @Param('id') id: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.serviceAccountsService.createApiKey(realm, id, dto);
  }

  @Get(':id/api-keys')
  @ApiOperation({ summary: 'List API keys for a service account' })
  listApiKeys(@CurrentRealm() realm: Realm, @Param('id') id: string) {
    return this.serviceAccountsService.listApiKeys(realm, id);
  }

  @Post(':id/api-keys/:keyId/revoke')
  @ApiOperation({ summary: 'Revoke an API key' })
  revokeApiKey(
    @CurrentRealm() realm: Realm,
    @Param('id') id: string,
    @Param('keyId') keyId: string,
  ) {
    return this.serviceAccountsService.revokeApiKey(realm, id, keyId);
  }

  @Post(':id/api-keys/:keyId/rotate')
  @ApiOperation({ summary: 'Rotate an API key (creates new key, keeps old active for grace period)' })
  rotateApiKey(
    @CurrentRealm() realm: Realm,
    @Param('id') id: string,
    @Param('keyId') keyId: string,
  ) {
    return this.serviceAccountsService.rotateApiKey(realm, id, keyId);
  }

  @Get(':id/metrics')
  @ApiOperation({ summary: 'Get usage metrics for a service account' })
  getUsageMetrics(@CurrentRealm() realm: Realm, @Param('id') id: string) {
    return this.serviceAccountsService.getUsageMetrics(realm, id);
  }
}
