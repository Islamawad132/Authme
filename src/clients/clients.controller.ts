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
import { ClientsService } from './clients.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';

@ApiTags('Clients')
@Controller('admin/realms/:realmName/clients')
@UseGuards(RealmGuard)
@ApiSecurity('admin-api-key')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a client in a realm' })
  create(@CurrentRealm() realm: Realm, @Body() dto: CreateClientDto) {
    return this.clientsService.create(realm, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List clients in a realm' })
  findAll(@CurrentRealm() realm: Realm) {
    return this.clientsService.findAll(realm);
  }

  @Get(':clientId')
  @ApiOperation({ summary: 'Get a client by ID' })
  findOne(
    @CurrentRealm() realm: Realm,
    @Param('clientId') clientId: string,
  ) {
    return this.clientsService.findByClientId(realm, clientId);
  }

  @Put(':clientId')
  @ApiOperation({ summary: 'Update a client' })
  update(
    @CurrentRealm() realm: Realm,
    @Param('clientId') clientId: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(realm, clientId, dto);
  }

  @Delete(':clientId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a client' })
  remove(
    @CurrentRealm() realm: Realm,
    @Param('clientId') clientId: string,
  ) {
    return this.clientsService.remove(realm, clientId);
  }

  @Post(':clientId/regenerate-secret')
  @ApiOperation({ summary: 'Regenerate client secret' })
  regenerateSecret(
    @CurrentRealm() realm: Realm,
    @Param('clientId') clientId: string,
  ) {
    return this.clientsService.regenerateSecret(realm, clientId);
  }

  @Get(':clientId/service-account-user')
  @ApiOperation({ summary: 'Get service account user for a client' })
  getServiceAccount(
    @CurrentRealm() realm: Realm,
    @Param('clientId') clientId: string,
  ) {
    return this.clientsService.getServiceAccount(realm, clientId);
  }
}
