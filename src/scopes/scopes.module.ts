import { Global, Module } from '@nestjs/common';
import { ScopesService } from './scopes.service.js';

@Global()
@Module({
  providers: [ScopesService],
  exports: [ScopesService],
})
export class ScopesModule {}
