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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Realm } from '@prisma/client';
import { ClientScopesService } from './client-scopes.service.js';
import { CreateClientScopeDto } from './dto/create-client-scope.dto.js';
import { UpdateClientScopeDto } from './dto/update-client-scope.dto.js';
import { AssignScopeDto } from './dto/assign-scope.dto.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';

@ApiTags('Client Scopes')
@Controller('admin/realms/:realmName')
@UseGuards(RealmGuard)
export class ClientScopesController {
  constructor(private readonly service: ClientScopesService) {}

  // ── Scope CRUD ─────────────────────────────────

  @Get('client-scopes')
  @ApiOperation({ summary: 'List client scopes in a realm' })
  findAll(@CurrentRealm() realm: Realm) {
    return this.service.findAll(realm);
  }

  @Get('client-scopes/:scopeId')
  @ApiOperation({ summary: 'Get a client scope' })
  findOne(@CurrentRealm() realm: Realm, @Param('scopeId') scopeId: string) {
    return this.service.findById(realm, scopeId);
  }

  @Post('client-scopes')
  @ApiOperation({ summary: 'Create a client scope' })
  create(@CurrentRealm() realm: Realm, @Body() dto: CreateClientScopeDto) {
    return this.service.create(realm, dto);
  }

  @Put('client-scopes/:scopeId')
  @ApiOperation({ summary: 'Update a client scope' })
  update(
    @CurrentRealm() realm: Realm,
    @Param('scopeId') scopeId: string,
    @Body() dto: UpdateClientScopeDto,
  ) {
    return this.service.update(realm, scopeId, dto);
  }

  @Delete('client-scopes/:scopeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a client scope' })
  remove(@CurrentRealm() realm: Realm, @Param('scopeId') scopeId: string) {
    return this.service.remove(realm, scopeId);
  }

  // ── Protocol Mappers ────────────────────────────

  @Post('client-scopes/:scopeId/protocol-mappers')
  @ApiOperation({ summary: 'Add a protocol mapper to a scope' })
  addMapper(
    @CurrentRealm() realm: Realm,
    @Param('scopeId') scopeId: string,
    @Body() body: { name: string; mapperType: string; protocol?: string; config?: Record<string, unknown> },
  ) {
    return this.service.addMapper(realm, scopeId, body);
  }

  @Put('client-scopes/:scopeId/protocol-mappers/:mapperId')
  @ApiOperation({ summary: 'Update a protocol mapper' })
  updateMapper(
    @CurrentRealm() realm: Realm,
    @Param('scopeId') scopeId: string,
    @Param('mapperId') mapperId: string,
    @Body() body: { name?: string; config?: Record<string, unknown> },
  ) {
    return this.service.updateMapper(realm, scopeId, mapperId, body);
  }

  @Delete('client-scopes/:scopeId/protocol-mappers/:mapperId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a protocol mapper' })
  removeMapper(
    @CurrentRealm() realm: Realm,
    @Param('scopeId') scopeId: string,
    @Param('mapperId') mapperId: string,
  ) {
    return this.service.removeMapper(realm, scopeId, mapperId);
  }

  // ── Client scope assignments ────────────────────

  @Get('clients/:clientId/default-client-scopes')
  @ApiOperation({ summary: 'Get default scopes assigned to a client' })
  getDefaultScopes(
    @CurrentRealm() realm: Realm,
    @Param('clientId') clientId: string,
  ) {
    return this.service.getDefaultScopes(realm, clientId);
  }

  @Post('clients/:clientId/default-client-scopes')
  @ApiOperation({ summary: 'Assign a default scope to a client' })
  assignDefaultScope(
    @CurrentRealm() realm: Realm,
    @Param('clientId') clientId: string,
    @Body() dto: AssignScopeDto,
  ) {
    return this.service.assignDefaultScope(realm, clientId, dto.clientScopeId);
  }

  @Delete('clients/:clientId/default-client-scopes/:scopeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a default scope from a client' })
  removeDefaultScope(
    @CurrentRealm() realm: Realm,
    @Param('clientId') clientId: string,
    @Param('scopeId') scopeId: string,
  ) {
    return this.service.removeDefaultScope(realm, clientId, scopeId);
  }

  @Get('clients/:clientId/optional-client-scopes')
  @ApiOperation({ summary: 'Get optional scopes assigned to a client' })
  getOptionalScopes(
    @CurrentRealm() realm: Realm,
    @Param('clientId') clientId: string,
  ) {
    return this.service.getOptionalScopes(realm, clientId);
  }

  @Post('clients/:clientId/optional-client-scopes')
  @ApiOperation({ summary: 'Assign an optional scope to a client' })
  assignOptionalScope(
    @CurrentRealm() realm: Realm,
    @Param('clientId') clientId: string,
    @Body() dto: AssignScopeDto,
  ) {
    return this.service.assignOptionalScope(realm, clientId, dto.clientScopeId);
  }

  @Delete('clients/:clientId/optional-client-scopes/:scopeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an optional scope from a client' })
  removeOptionalScope(
    @CurrentRealm() realm: Realm,
    @Param('clientId') clientId: string,
    @Param('scopeId') scopeId: string,
  ) {
    return this.service.removeOptionalScope(realm, clientId, scopeId);
  }
}
