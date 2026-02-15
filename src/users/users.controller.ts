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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
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
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a user in a realm' })
  create(@CurrentRealm() realm: Realm, @Body() dto: CreateUserDto) {
    return this.usersService.create(realm, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List users in a realm' })
  findAll(@CurrentRealm() realm: Realm, @Query() pagination: PaginationDto) {
    return this.usersService.findAll(realm, pagination.skip, pagination.limit);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get a user by ID' })
  findOne(@CurrentRealm() realm: Realm, @Param('userId') userId: string) {
    return this.usersService.findById(realm, userId);
  }

  @Put(':userId')
  @ApiOperation({ summary: 'Update a user' })
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
  remove(@CurrentRealm() realm: Realm, @Param('userId') userId: string) {
    return this.usersService.remove(realm, userId);
  }

  @Put(':userId/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set a user password' })
  resetPassword(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
    @Body() dto: SetPasswordDto,
  ) {
    return this.usersService.setPassword(realm, userId, dto.password);
  }

  @Post(':userId/send-verification-email')
  @ApiOperation({ summary: 'Send or resend verification email to a user' })
  async sendVerificationEmail(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
  ) {
    const user = await this.usersService.findById(realm, userId);
    if (!user.email) {
      return { message: 'User has no email address' };
    }
    await this.usersService.sendVerificationEmail(realm.name, user.id, user.email);
    return { message: 'Verification email sent' };
  }
}
