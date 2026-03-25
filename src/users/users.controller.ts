import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiResponse } from '@nestjs/swagger';
import type { Realm } from '@prisma/client';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { SetPasswordDto } from './dto/set-password.dto.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';

@ApiTags('Users')
@Controller('admin/realms/:realmName/users')
@UseGuards(RealmGuard)
@ApiSecurity('admin-api-key')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a user in a realm' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@CurrentRealm() realm: Realm, @Body() dto: CreateUserDto) {
    return this.usersService.create(realm, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List users in a realm' })
  @ApiResponse({ status: 200, description: 'List of users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@CurrentRealm() realm: Realm, @Query() pagination: PaginationDto) {
    return this.usersService.findAll(realm, pagination.skip, pagination.limit);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@CurrentRealm() realm: Realm, @Param('userId') userId: string) {
    return this.usersService.findById(realm, userId);
  }

  @Put(':userId')
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(realm, userId, dto);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 204, description: 'User deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(@CurrentRealm() realm: Realm, @Param('userId') userId: string) {
    return this.usersService.remove(realm, userId);
  }

  @Put(':userId/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set a user password' })
  @ApiResponse({ status: 204, description: 'Password updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid password' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  resetPassword(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
    @Body() dto: SetPasswordDto,
  ) {
    return this.usersService.setPassword(realm, userId, dto.password);
  }

  @Post(':userId/send-verification-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send or resend verification email to a user' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async sendVerificationEmail(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
  ) {
    const user = await this.usersService.findById(realm, userId);
    if (!user.email) {
      return { message: 'User has no email address' };
    }
    await this.usersService.sendVerificationEmail(realm, user.id, user.email);
    return { message: 'Verification email sent' };
  }

  @Get(':userId/offline-sessions')
  @ApiOperation({ summary: 'List offline sessions for a user' })
  @ApiResponse({ status: 200, description: 'List of offline sessions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getOfflineSessions(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
  ) {
    return this.usersService.getOfflineSessions(realm, userId);
  }

  @Delete(':userId/offline-sessions/:tokenId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an offline session' })
  @ApiResponse({ status: 204, description: 'Offline session revoked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User or session not found' })
  revokeOfflineSession(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
    @Param('tokenId') tokenId: string,
  ) {
    return this.usersService.revokeOfflineSession(realm, userId, tokenId);
  }
}
