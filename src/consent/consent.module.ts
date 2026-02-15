import { Module, Global } from '@nestjs/common';
import { ConsentService } from './consent.service.js';

@Global()
@Module({
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
