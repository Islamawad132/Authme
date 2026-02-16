import { Module } from '@nestjs/common';
import { TokensController } from './tokens.controller.js';
import { TokensService } from './tokens.service.js';
import { TokenBlacklistService } from './token-blacklist.service.js';
import { BackchannelLogoutService } from './backchannel-logout.service.js';

@Module({
  controllers: [TokensController],
  providers: [TokensService, TokenBlacklistService, BackchannelLogoutService],
  exports: [TokensService, TokenBlacklistService, BackchannelLogoutService],
})
export class TokensModule {}
