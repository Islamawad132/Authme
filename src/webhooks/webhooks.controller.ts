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
import { WebhooksService } from './webhooks.service.js';
import { CreateWebhookDto, UpdateWebhookDto } from './webhooks.dto.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';

@ApiTags('Webhooks')
@Controller('admin/realms/:realmName/webhooks')
@UseGuards(RealmGuard)
@ApiSecurity('admin-api-key')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a webhook in a realm' })
  create(@CurrentRealm() realm: Realm, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(realm, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List webhooks in a realm' })
  findAll(@CurrentRealm() realm: Realm) {
    return this.webhooksService.findAll(realm);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a webhook by ID' })
  findOne(@CurrentRealm() realm: Realm, @Param('id') id: string) {
    return this.webhooksService.findOne(realm, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a webhook' })
  update(
    @CurrentRealm() realm: Realm,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.update(realm, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a webhook' })
  remove(@CurrentRealm() realm: Realm, @Param('id') id: string) {
    return this.webhooksService.remove(realm, id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Send a test event to the webhook' })
  test(@CurrentRealm() realm: Realm, @Param('id') id: string) {
    return this.webhooksService.testWebhook(realm, id);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'List delivery logs for a webhook' })
  deliveries(@CurrentRealm() realm: Realm, @Param('id') id: string) {
    return this.webhooksService.findDeliveries(realm, id);
  }
}
