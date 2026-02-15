import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import type { Realm } from '@prisma/client';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';
import { IdentityProvidersService } from './identity-providers.service.js';
import { CreateIdentityProviderDto } from './dto/create-identity-provider.dto.js';
import { UpdateIdentityProviderDto } from './dto/update-identity-provider.dto.js';

@ApiTags('Identity Providers')
@ApiSecurity('admin-api-key')
@Controller('admin/realms/:realmName/identity-providers')
@UseGuards(RealmGuard)
export class IdentityProvidersController {
  constructor(private readonly idpService: IdentityProvidersService) {}

  @Post()
  @ApiOperation({ summary: 'Create an identity provider' })
  create(
    @CurrentRealm() realm: Realm,
    @Body() dto: CreateIdentityProviderDto,
  ) {
    return this.idpService.create(realm, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List identity providers' })
  findAll(@CurrentRealm() realm: Realm) {
    return this.idpService.findAll(realm);
  }

  @Get(':alias')
  @ApiOperation({ summary: 'Get identity provider by alias' })
  findByAlias(
    @CurrentRealm() realm: Realm,
    @Param('alias') alias: string,
  ) {
    return this.idpService.findByAlias(realm, alias);
  }

  @Put(':alias')
  @ApiOperation({ summary: 'Update identity provider' })
  update(
    @CurrentRealm() realm: Realm,
    @Param('alias') alias: string,
    @Body() dto: UpdateIdentityProviderDto,
  ) {
    return this.idpService.update(realm, alias, dto);
  }

  @Delete(':alias')
  @ApiOperation({ summary: 'Delete identity provider' })
  remove(
    @CurrentRealm() realm: Realm,
    @Param('alias') alias: string,
  ) {
    return this.idpService.remove(realm, alias);
  }
}
