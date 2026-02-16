import { Global, Module } from '@nestjs/common';
import { ScopesService } from './scopes.service.js';
import { ProtocolMapperExecutor } from './protocol-mapper.executor.js';
import { ScopeSeedService } from './scope-seed.service.js';

@Global()
@Module({
  providers: [ScopesService, ProtocolMapperExecutor, ScopeSeedService],
  exports: [ScopesService, ProtocolMapperExecutor, ScopeSeedService],
})
export class ScopesModule {}
