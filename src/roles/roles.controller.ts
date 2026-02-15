import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Realm } from '@prisma/client';
import { RolesService } from './roles.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { AssignRolesDto } from './dto/assign-role.dto.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';

@ApiTags('Roles')
@Controller('admin/realms/:realmName')
@UseGuards(RealmGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // ─── Realm Roles ────────────────────────────────────────

  @Post('roles')
  @ApiOperation({ summary: 'Create a realm role' })
  createRealmRole(
    @CurrentRealm() realm: Realm,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rolesService.createRealmRole(realm, dto.name, dto.description);
  }

  @Get('roles')
  @ApiOperation({ summary: 'List realm roles' })
  findRealmRoles(@CurrentRealm() realm: Realm) {
    return this.rolesService.findRealmRoles(realm);
  }

  @Delete('roles/:roleName')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a realm role' })
  deleteRealmRole(
    @CurrentRealm() realm: Realm,
    @Param('roleName') roleName: string,
  ) {
    return this.rolesService.deleteRealmRole(realm, roleName);
  }

  // ─── Client Roles ──────────────────────────────────────

  @Post('clients/:clientId/roles')
  @ApiOperation({ summary: 'Create a client role' })
  createClientRole(
    @CurrentRealm() realm: Realm,
    @Param('clientId') clientId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rolesService.createClientRole(
      realm,
      clientId,
      dto.name,
      dto.description,
    );
  }

  @Get('clients/:clientId/roles')
  @ApiOperation({ summary: 'List client roles' })
  findClientRoles(
    @CurrentRealm() realm: Realm,
    @Param('clientId') clientId: string,
  ) {
    return this.rolesService.findClientRoles(realm, clientId);
  }

  // ─── User Realm Role Assignment ─────────────────────────

  @Post('users/:userId/role-mappings/realm')
  @ApiOperation({ summary: 'Assign realm roles to a user' })
  assignRealmRoles(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
    @Body() dto: AssignRolesDto,
  ) {
    return this.rolesService.assignRealmRoles(realm, userId, dto.roleNames);
  }

  @Get('users/:userId/role-mappings/realm')
  @ApiOperation({ summary: "List a user's realm roles" })
  getUserRealmRoles(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
  ) {
    return this.rolesService.getUserRealmRoles(realm, userId);
  }

  @Delete('users/:userId/role-mappings/realm')
  @ApiOperation({ summary: 'Remove realm roles from a user' })
  removeUserRealmRoles(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
    @Body() dto: AssignRolesDto,
  ) {
    return this.rolesService.removeUserRealmRoles(
      realm,
      userId,
      dto.roleNames,
    );
  }

  // ─── User Client Role Assignment ────────────────────────

  @Post('users/:userId/role-mappings/clients/:clientId')
  @ApiOperation({ summary: 'Assign client roles to a user' })
  assignClientRoles(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
    @Param('clientId') clientId: string,
    @Body() dto: AssignRolesDto,
  ) {
    return this.rolesService.assignClientRoles(
      realm,
      userId,
      clientId,
      dto.roleNames,
    );
  }

  @Get('users/:userId/role-mappings/clients/:clientId')
  @ApiOperation({ summary: "List a user's client roles" })
  getUserClientRoles(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
    @Param('clientId') clientId: string,
  ) {
    return this.rolesService.getUserClientRoles(realm, userId, clientId);
  }
}
