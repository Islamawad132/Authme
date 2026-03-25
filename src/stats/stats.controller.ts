import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import type { Realm } from '@prisma/client';
import { StatsService } from './stats.service.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';

@ApiTags('Stats')
@Controller('admin/realms/:realmName')
@UseGuards(RealmGuard)
@ApiSecurity('admin-api-key')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics for a realm' })
  @ApiResponse({ status: 200, description: 'Realm dashboard statistics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getStats(@CurrentRealm() realm: Realm) {
    return this.statsService.getRealmStats(realm);
  }
}
