import { Global, Module } from '@nestjs/common';
import { PluginsController } from './plugins.controller.js';
import { PluginManagerService } from './plugin-manager.service.js';
import { PluginLoaderService } from './plugin-loader.service.js';
import { PluginRegistry } from './plugin-registry.js';

/**
 * PluginsModule wires together the plugin system and exports PluginManagerService
 * so that other modules (EventsService, auth token flow) can call into it.
 *
 * Marked @Global so that PluginManagerService is available application-wide
 * without needing to import PluginsModule in every consumer.
 */
@Global()
@Module({
  controllers: [PluginsController],
  providers: [PluginRegistry, PluginLoaderService, PluginManagerService],
  exports: [PluginManagerService],
})
export class PluginsModule {}
