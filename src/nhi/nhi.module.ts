import { Module } from '@nestjs/common';
import { NhiController } from './nhi.controller.js';
import { NhiService } from './nhi.service.js';

@Module({
  controllers: [NhiController],
  providers: [NhiService],
  exports: [NhiService],
})
export class NhiModule {}