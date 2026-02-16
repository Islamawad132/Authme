import { Module, Global } from '@nestjs/common';
import { ConsentService } from './consent.service.js';
import { CryptoModule } from '../crypto/crypto.module.js';

@Global()
@Module({
  imports: [CryptoModule],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
