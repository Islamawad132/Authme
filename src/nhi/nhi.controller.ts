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
import { ApiTags, ApiOperation, ApiSecurity, ApiResponse } from '@nestjs/swagger';
import type { Realm } from '@prisma/client';
import { NhiService } from './nhi.service.js';
import { CreateNhiIdentityDto } from './dto/create-nhi.dto.js';
import { UpdateNhiIdentityDto } from './dto/update-nhi.dto.js';
import { CreateNhiCredentialDto } from './dto/create-nhi-credential.dto.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';

@ApiTags('NHI Identities')
@Controller('admin/realms/:realmName/nhi')
@UseGuards(RealmGuard)
@ApiSecurity('admin-api-key')
export class NhiController {
  constructor(private readonly nhiService: NhiService) {}

  // ── NHI Identity endpoints ───────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create an NHI identity in a realm' })
  @ApiResponse({ status: 201, description: 'NHI identity created' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'NHI identity already exists' })
  create(@CurrentRealm() realm: Realm, @Body() dto: CreateNhiIdentityDto) {
    return this.nhiService.create(realm, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List NHI identities in a realm' })
  @ApiResponse({ status: 200, description: 'List of NHI identities' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@CurrentRealm() realm: Realm) {
    return this.nhiService.findAll(realm);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an NHI identity by ID' })
  @ApiResponse({ status: 200, description: 'NHI identity details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'NHI identity not found' })
  findOne(@CurrentRealm() realm: Realm, @Param('id') id: string) {
    return this.nhiService.findById(realm, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an NHI identity' })
  @ApiResponse({ status: 200, description: 'NHI identity updated' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'NHI identity not found' })
  @ApiResponse({ status: 409, description: 'NHI identity name already taken' })
  update(
    @CurrentRealm() realm: Realm,
    @Param('id') id: string,
    @Body() dto: UpdateNhiIdentityDto,
  ) {
    return this.nhiService.update(realm, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an NHI identity' })
  @ApiResponse({ status: 204, description: 'NHI identity deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'NHI identity not found' })
  remove(@CurrentRealm() realm: Realm, @Param('id') id: string) {
    return this.nhiService.remove(realm, id);
  }

  // ── Lifecycle endpoints ─────────────────────────────────────────────────────

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend an NHI identity' })
  @ApiResponse({ status: 200, description: 'NHI identity suspended' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'NHI identity not found' })
  suspend(@CurrentRealm() realm: Realm, @Param('id') id: string) {
    return this.nhiService.suspend(realm, id);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a suspended NHI identity' })
  @ApiResponse({ status: 200, description: 'NHI identity reactivated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'NHI identity not found' })
  @ApiResponse({ status: 409, description: 'Identity is not suspended' })
  reactivate(@CurrentRealm() realm: Realm, @Param('id') id: string) {
    return this.nhiService.reactivate(realm, id);
  }

  @Post(':id/decommission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decommission an NHI identity (revokes all credentials)' })
  @ApiResponse({ status: 200, description: 'NHI identity decommissioned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'NHI identity not found' })
  decommission(@CurrentRealm() realm: Realm, @Param('id') id: string) {
    return this.nhiService.decommission(realm, id);
  }

  // ── Credential endpoints ────────────────────────────────────────────────────

  @Post(':id/credentials')
  @ApiOperation({ summary: 'Create a credential for an NHI identity' })
  @ApiResponse({ status: 201, description: 'Credential created' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'NHI identity not found' })
  createCredential(
    @CurrentRealm() realm: Realm,
    @Param('id') id: string,
    @Body() dto: CreateNhiCredentialDto,
  ) {
    return this.nhiService.createCredential(realm, id, dto);
  }

  @Get(':id/credentials')
  @ApiOperation({ summary: 'List credentials for an NHI identity' })
  @ApiResponse({ status: 200, description: 'List of credentials' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'NHI identity not found' })
  listCredentials(@CurrentRealm() realm: Realm, @Param('id') id: string) {
    return this.nhiService.listCredentials(realm, id);
  }

  @Post(':id/credentials/:credentialId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a credential' })
  @ApiResponse({ status: 200, description: 'Credential revoked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'NHI identity or credential not found' })
  revokeCredential(
    @CurrentRealm() realm: Realm,
    @Param('id') id: string,
    @Param('credentialId') credentialId: string,
  ) {
    return this.nhiService.revokeCredential(realm, id, credentialId);
  }

  @Post(':id/credentials/:credentialId/rotate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a credential (creates new key, keeps old active for grace period)' })
  @ApiResponse({ status: 200, description: 'Credential rotated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'NHI identity or credential not found' })
  @ApiResponse({ status: 409, description: 'Only API_KEY credentials can be rotated' })
  rotateCredential(
    @CurrentRealm() realm: Realm,
    @Param('id') id: string,
    @Param('credentialId') credentialId: string,
  ) {
    return this.nhiService.rotateCredential(realm, id, credentialId);
  }

  // ── Certificate management ─────────────────────────────────────────────────

  @Post(':id/certificate')
  @ApiOperation({ summary: 'Set certificate for an NHI identity' })
  @ApiResponse({ status: 200, description: 'Certificate set' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'NHI identity not found' })
  setCertificate(
    @CurrentRealm() realm: Realm,
    @Param('id') id: string,
    @Body() body: { certificatePem: string; privateKeyPem?: string; certificateChain?: string },
  ) {
    return this.nhiService.setCertificate(
      realm,
      id,
      body.certificatePem,
      body.privateKeyPem,
      body.certificateChain,
    );
  }

  // ── Usage statistics ────────────────────────────────────────────────────────

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get usage statistics for an NHI identity' })
  @ApiResponse({ status: 200, description: 'NHI identity usage statistics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'NHI identity not found' })
  getUsageStats(@CurrentRealm() realm: Realm, @Param('id') id: string) {
    return this.nhiService.getUsageStats(realm, id);
  }
}
