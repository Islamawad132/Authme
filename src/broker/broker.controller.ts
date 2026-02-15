import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import type { Realm } from '@prisma/client';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { BrokerService } from './broker.service.js';

@ApiTags('Identity Broker')
@Controller('realms/:realmName/broker')
@UseGuards(RealmGuard)
@Public()
export class BrokerController {
  constructor(private readonly brokerService: BrokerService) {}

  @Get(':alias/login')
  @ApiOperation({ summary: 'Initiate social login with an external provider' })
  async login(
    @CurrentRealm() realm: Realm,
    @Param('alias') alias: string,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const redirectUrl = await this.brokerService.initiateLogin(realm, alias, {
      client_id: query['client_id'],
      redirect_uri: query['redirect_uri'],
      scope: query['scope'],
      state: query['state'],
      nonce: query['nonce'],
    });

    res.redirect(302, redirectUrl);
  }

  @Get(':alias/callback')
  @ApiOperation({ summary: 'Handle callback from external identity provider' })
  async callback(
    @CurrentRealm() realm: Realm,
    @Param('alias') alias: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const result = await this.brokerService.handleCallback(realm, alias, code, state);
    res.redirect(302, result.redirectUrl);
  }
}
