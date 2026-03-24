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
import { CustomAttributesService } from './custom-attributes.service.js';
import { CreateCustomAttributeDto } from './dto/create-custom-attribute.dto.js';
import { UpdateCustomAttributeDto } from './dto/update-custom-attribute.dto.js';
import { SetUserAttributesDto } from './dto/set-user-attributes.dto.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';

@ApiTags('Custom Attributes')
@Controller('admin/realms/:realmName/custom-attributes')
@UseGuards(RealmGuard)
@ApiSecurity('admin-api-key')
export class CustomAttributesController {
  constructor(private readonly service: CustomAttributesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a custom attribute definition for a realm' })
  create(@CurrentRealm() realm: Realm, @Body() dto: CreateCustomAttributeDto) {
    return this.service.createAttribute(realm, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all custom attribute definitions for a realm' })
  findAll(@CurrentRealm() realm: Realm) {
    return this.service.findAllAttributes(realm);
  }

  @Get(':attributeId')
  @ApiOperation({ summary: 'Get a custom attribute definition by ID' })
  findOne(@CurrentRealm() realm: Realm, @Param('attributeId') attributeId: string) {
    return this.service.findAttributeById(realm, attributeId);
  }

  @Put(':attributeId')
  @ApiOperation({ summary: 'Update a custom attribute definition' })
  update(
    @CurrentRealm() realm: Realm,
    @Param('attributeId') attributeId: string,
    @Body() dto: UpdateCustomAttributeDto,
  ) {
    return this.service.updateAttribute(realm, attributeId, dto);
  }

  @Delete(':attributeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a custom attribute definition' })
  remove(@CurrentRealm() realm: Realm, @Param('attributeId') attributeId: string) {
    return this.service.removeAttribute(realm, attributeId);
  }
}

@ApiTags('Custom Attributes')
@Controller('admin/realms/:realmName/users/:userId/attributes')
@UseGuards(RealmGuard)
@ApiSecurity('admin-api-key')
export class UserAttributesController {
  constructor(private readonly service: CustomAttributesService) {}

  @Get()
  @ApiOperation({ summary: 'Get attribute values for a user' })
  getAttributes(@CurrentRealm() realm: Realm, @Param('userId') userId: string) {
    return this.service.getUserAttributes(realm, userId);
  }

  @Put()
  @ApiOperation({ summary: 'Set attribute values for a user' })
  setAttributes(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
    @Body() dto: SetUserAttributesDto,
  ) {
    return this.service.setUserAttributes(realm, userId, dto.attributes);
  }
}
