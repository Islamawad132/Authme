import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { PluginManagerService } from './plugin-manager.service.js';

@ApiTags('Plugins')
@Controller('admin/plugins')
@ApiSecurity('admin-api-key')
export class PluginsController {
  constructor(private readonly pluginManager: PluginManagerService) {}

  @Get()
  @ApiOperation({ summary: 'List all installed plugins' })
  list() {
    return this.pluginManager.listPlugins();
  }

  @Get(':name')
  @ApiOperation({ summary: 'Get details for a specific plugin' })
  getOne(@Param('name') name: string) {
    return this.pluginManager.getPlugin(name);
  }

  @Post(':name/enable')
  @ApiOperation({ summary: 'Enable a plugin' })
  enable(@Param('name') name: string) {
    return this.pluginManager.enablePlugin(name);
  }

  @Post(':name/disable')
  @ApiOperation({ summary: 'Disable a plugin' })
  disable(@Param('name') name: string) {
    return this.pluginManager.disablePlugin(name);
  }

  @Delete(':name')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Uninstall a plugin' })
  async remove(@Param('name') name: string): Promise<void> {
    await this.pluginManager.uninstallPlugin(name);
  }
}
