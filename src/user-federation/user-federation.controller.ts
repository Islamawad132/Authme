import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserFederationService } from './user-federation.service.js';
import { CreateUserFederationDto } from './dto/create-user-federation.dto.js';
import { UpdateUserFederationDto } from './dto/update-user-federation.dto.js';

@ApiTags('User Federation')
@Controller('admin/realms/:realmName/user-federation')
export class UserFederationController {
  constructor(private readonly service: UserFederationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a user federation provider' })
  create(
    @Param('realmName') realmName: string,
    @Body() dto: CreateUserFederationDto,
  ) {
    return this.service.create(realmName, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user federation providers' })
  findAll(@Param('realmName') realmName: string) {
    return this.service.findAll(realmName);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user federation provider' })
  findOne(
    @Param('realmName') realmName: string,
    @Param('id') id: string,
  ) {
    return this.service.findById(realmName, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a user federation provider' })
  update(
    @Param('realmName') realmName: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserFederationDto,
  ) {
    return this.service.update(realmName, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user federation provider' })
  remove(
    @Param('realmName') realmName: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(realmName, id);
  }

  @Post(':id/test-connection')
  @ApiOperation({ summary: 'Test LDAP connection' })
  testConnection(
    @Param('realmName') realmName: string,
    @Param('id') id: string,
  ) {
    return this.service.testConnection(realmName, id);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Trigger full LDAP sync' })
  sync(
    @Param('realmName') realmName: string,
    @Param('id') id: string,
  ) {
    return this.service.syncUsers(realmName, id);
  }
}
