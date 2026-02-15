import { Module } from '@nestjs/common';
import { TokensController } from './tokens.controller.js';
import { TokensService } from './tokens.service.js';

@Module({
  controllers: [TokensController],
  providers: [TokensService],
})
export class TokensModule {}
