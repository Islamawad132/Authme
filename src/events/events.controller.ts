import {
  Controller,
  Get,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import type { Realm } from '@prisma/client';
import { EventsService } from './events.service.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';

@ApiTags('Events')
@Controller('admin/realms/:realmName')
@UseGuards(RealmGuard)
@ApiSecurity('admin-api-key')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('events')
  @ApiOperation({ summary: 'Query login events' })
  getLoginEvents(
    @CurrentRealm() realm: Realm,
    @Query('type') type?: string,
    @Query('userId') userId?: string,
    @Query('clientId') clientId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('first') first?: string,
    @Query('max') max?: string,
  ) {
    return this.eventsService.queryLoginEvents({
      realmId: realm.id,
      type,
      userId,
      clientId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      first: first ? parseInt(first, 10) : undefined,
      max: max ? parseInt(max, 10) : undefined,
    });
  }

  @Delete('events')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear login events' })
  clearLoginEvents(@CurrentRealm() realm: Realm) {
    return this.eventsService.clearLoginEvents(realm.id);
  }

  @Get('admin-events')
  @ApiOperation({ summary: 'Query admin events' })
  getAdminEvents(
    @CurrentRealm() realm: Realm,
    @Query('operationType') operationType?: string,
    @Query('resourceType') resourceType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('first') first?: string,
    @Query('max') max?: string,
  ) {
    return this.eventsService.queryAdminEvents({
      realmId: realm.id,
      operationType,
      resourceType,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      first: first ? parseInt(first, 10) : undefined,
      max: max ? parseInt(max, 10) : undefined,
    });
  }
}
