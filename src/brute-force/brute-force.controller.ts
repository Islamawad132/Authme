import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import type { Realm } from '@prisma/client';
import { BruteForceService } from './brute-force.service.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';

@ApiTags('Brute Force Protection')
@Controller('admin/realms/:realmName/brute-force')
@UseGuards(RealmGuard)
@ApiSecurity('admin-api-key')
export class BruteForceController {
  constructor(private readonly bruteForceService: BruteForceService) {}

  @Get('locked-users')
  @ApiOperation({ summary: 'List locked users in a realm' })
  @ApiResponse({ status: 200, description: 'List of locked users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getLockedUsers(@CurrentRealm() realm: Realm) {
    return this.bruteForceService.getLockedUsers(realm.id);
  }

  @Post('users/:userId/unlock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlock a locked user' })
  @ApiResponse({ status: 200, description: 'User unlocked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async unlockUser(@Param('userId') userId: string) {
    await this.bruteForceService.unlockUser(userId);
    return { message: 'User unlocked' };
  }
}
