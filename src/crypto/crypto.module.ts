import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service.js';
import { JwkService } from './jwk.service.js';

@Global()
@Module({
  providers: [CryptoService, JwkService],
  exports: [CryptoService, JwkService],
})
export class CryptoModule {}
