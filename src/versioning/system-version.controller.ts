import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { MigrationCheckService } from './migration-check.service.js';
import { APP_VERSION } from './app-version.js';

@ApiTags('System')
@Controller('admin/system')
@ApiSecurity('admin-api-key')
export class SystemVersionController {
  constructor(private readonly migrationCheck: MigrationCheckService) {}

  /**
   * GET /admin/system/version
   *
   * Returns the running application version, the current database schema
   * version (last applied migration), and a list of any pending migrations.
   */
  @Get('version')
  @ApiOperation({
    summary: 'Get system version and database schema status',
    description:
      'Returns the application version, the schema version derived from the ' +
      'last applied Prisma migration, and the names of any unapplied migrations.',
  })
  async getVersion() {
    const migrationStatus = await this.migrationCheck.getStatus();

    return {
      version: APP_VERSION,
      schemaVersion: migrationStatus.schemaVersion,
      pendingMigrations: migrationStatus.pendingMigrations,
      databaseUpToDate: migrationStatus.pendingCount === 0,
    };
  }
}
