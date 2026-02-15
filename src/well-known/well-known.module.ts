import { Module } from '@nestjs/common';
import { WellKnownController } from './well-known.controller.js';

@Module({
  controllers: [WellKnownController],
})
export class WellKnownModule {}
