import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

/**
 * DatabaseModule provides a provider-aware PrismaClient wrapper.
 *
 * It is decorated with @Global so that DatabaseService is available for
 * injection in every module without needing to import DatabaseModule
 * explicitly. The DatabaseService detects the active database provider from
 * the DATABASE_URL environment variable and configures the Prisma driver
 * accordingly.
 *
 * Supported providers:
 *   - PostgreSQL  (DATABASE_URL starts with postgresql:// or postgres://)
 *   - MySQL       (DATABASE_URL starts with mysql://)
 *   - SQLite      (DATABASE_URL starts with file:)
 */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
