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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Realm } from '@prisma/client';
import { GroupsService } from './groups.service.js';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { UpdateGroupDto } from './dto/update-group.dto.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';

@ApiTags('Groups')
@Controller('admin/realms/:realmName')
@UseGuards(RealmGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  // ─── Group CRUD ──────────────────────────────

  @Post('groups')
  @ApiOperation({ summary: 'Create a group' })
  create(@CurrentRealm() realm: Realm, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(realm, dto);
  }

  @Get('groups')
  @ApiOperation({ summary: 'List all groups' })
  findAll(@CurrentRealm() realm: Realm) {
    return this.groupsService.findAll(realm);
  }

  @Get('groups/:groupId')
  @ApiOperation({ summary: 'Get group by ID' })
  findById(@CurrentRealm() realm: Realm, @Param('groupId') groupId: string) {
    return this.groupsService.findById(realm, groupId);
  }

  @Put('groups/:groupId')
  @ApiOperation({ summary: 'Update a group' })
  update(
    @CurrentRealm() realm: Realm,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.update(realm, groupId, dto);
  }

  @Delete('groups/:groupId')
  @ApiOperation({ summary: 'Delete a group' })
  delete(@CurrentRealm() realm: Realm, @Param('groupId') groupId: string) {
    return this.groupsService.delete(realm, groupId);
  }

  // ─── Group Members ───────────────────────────

  @Get('groups/:groupId/members')
  @ApiOperation({ summary: 'List group members' })
  getMembers(@CurrentRealm() realm: Realm, @Param('groupId') groupId: string) {
    return this.groupsService.getMembers(realm, groupId);
  }

  @Put('users/:userId/groups/:groupId')
  @ApiOperation({ summary: 'Add user to group' })
  addUserToGroup(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.groupsService.addUserToGroup(realm, userId, groupId);
  }

  @Delete('users/:userId/groups/:groupId')
  @ApiOperation({ summary: 'Remove user from group' })
  removeUserFromGroup(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.groupsService.removeUserFromGroup(realm, userId, groupId);
  }

  @Get('users/:userId/groups')
  @ApiOperation({ summary: "List user's groups" })
  getUserGroups(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
  ) {
    return this.groupsService.getUserGroups(realm, userId);
  }

  // ─── Group Role Mappings ─────────────────────

  @Get('groups/:groupId/role-mappings')
  @ApiOperation({ summary: 'Get group role mappings' })
  getGroupRoles(
    @CurrentRealm() realm: Realm,
    @Param('groupId') groupId: string,
  ) {
    return this.groupsService.getGroupRoles(realm, groupId);
  }

  @Post('groups/:groupId/role-mappings')
  @ApiOperation({ summary: 'Assign roles to group' })
  assignRoles(
    @CurrentRealm() realm: Realm,
    @Param('groupId') groupId: string,
    @Body() body: { roleNames: string[] },
  ) {
    return this.groupsService.assignRolesToGroup(realm, groupId, body.roleNames);
  }

  @Delete('groups/:groupId/role-mappings')
  @ApiOperation({ summary: 'Remove roles from group' })
  removeRoles(
    @CurrentRealm() realm: Realm,
    @Param('groupId') groupId: string,
    @Body() body: { roleNames: string[] },
  ) {
    return this.groupsService.removeRolesFromGroup(realm, groupId, body.roleNames);
  }
}
