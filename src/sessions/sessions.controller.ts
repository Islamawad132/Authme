import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Realm } from '@prisma/client';
import { SessionsService } from './sessions.service.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';

@ApiTags('Sessions')
@Controller('admin/realms/:realmName')
@UseGuards(RealmGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('sessions')
  @ApiOperation({ summary: 'List all active sessions in the realm' })
  getRealmSessions(@CurrentRealm() realm: Realm) {
    return this.sessionsService.getRealmSessions(realm);
  }

  @Get('users/:userId/sessions')
  @ApiOperation({ summary: 'List active sessions for a user' })
  getUserSessions(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
  ) {
    return this.sessionsService.getUserSessions(realm, userId);
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({ summary: 'Revoke a specific session' })
  revokeSession(
    @Param('sessionId') sessionId: string,
    @Query('type') type: 'oauth' | 'sso' = 'oauth',
  ) {
    return this.sessionsService.revokeSession(sessionId, type);
  }

  @Delete('users/:userId/sessions')
  @ApiOperation({ summary: 'Revoke all sessions for a user' })
  revokeAllUserSessions(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
  ) {
    return this.sessionsService.revokeAllUserSessions(realm, userId);
  }
}
