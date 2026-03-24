import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import type { AuthMePlugin } from './plugin.interface.js';

export interface DiscoveredPlugin {
  plugin: AuthMePlugin;
  source: 'directory' | 'npm';
  sourcePath: string;
}

/**
 * PluginLoaderService discovers and loads plugins from two sources:
 *
 * 1. `plugins/` directory at the project root — each subdirectory is a plugin.
 *    The subdirectory must export a default export or a named `plugin` export
 *    that satisfies the AuthMePlugin interface.
 *
 * 2. npm packages with the `authme-plugin-` prefix installed in node_modules.
 */
@Injectable()
export class PluginLoaderService {
  private readonly logger = new Logger(PluginLoaderService.name);

  /**
   * Discover all plugins from the plugins directory and npm packages.
   * Failures in individual plugins are isolated and logged; other plugins
   * continue loading.
   */
  async discoverAll(pluginsRootDir?: string, nodeModulesDir?: string): Promise<DiscoveredPlugin[]> {
    const discovered: DiscoveredPlugin[] = [];

    const fromDir = await this.discoverFromDirectory(pluginsRootDir);
    discovered.push(...fromDir);

    const fromNpm = await this.discoverFromNpm(nodeModulesDir);
    discovered.push(...fromNpm);

    return discovered;
  }

  /**
   * Load plugins from a `plugins/` directory. Each immediate subdirectory is
   * treated as a plugin package. The directory must contain an `index.js` (or
   * `index.ts` when running with ts-node) file.
   */
  async discoverFromDirectory(pluginsRootDir?: string): Promise<DiscoveredPlugin[]> {
    const rootDir = pluginsRootDir ?? resolve(process.cwd(), 'plugins');

    if (!existsSync(rootDir)) {
      this.logger.debug(`Plugins directory '${rootDir}' does not exist; skipping.`);
      return [];
    }

    const discovered: DiscoveredPlugin[] = [];
    let entries: string[];

    try {
      entries = readdirSync(rootDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch (err) {
      this.logger.warn(`Failed to read plugins directory '${rootDir}': ${(err as Error).message}`);
      return [];
    }

    for (const entry of entries) {
      const pluginPath = join(rootDir, entry);
      const pluginResult = await this.loadFromPath(pluginPath, 'directory');
      if (pluginResult) {
        discovered.push(pluginResult);
      }
    }

    return discovered;
  }

  /**
   * Discover plugins installed as npm packages with the `authme-plugin-` prefix.
   */
  async discoverFromNpm(nodeModulesDir?: string): Promise<DiscoveredPlugin[]> {
    const nmDir = nodeModulesDir ?? resolve(process.cwd(), 'node_modules');

    if (!existsSync(nmDir)) {
      return [];
    }

    const discovered: DiscoveredPlugin[] = [];
    let entries: string[];

    try {
      entries = readdirSync(nmDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name.startsWith('authme-plugin-'))
        .map((d) => d.name);
    } catch (err) {
      this.logger.warn(`Failed to read node_modules for npm plugins: ${(err as Error).message}`);
      return [];
    }

    for (const packageName of entries) {
      const pluginPath = join(nmDir, packageName);
      const pluginResult = await this.loadFromPath(pluginPath, 'npm');
      if (pluginResult) {
        discovered.push(pluginResult);
      }
    }

    return discovered;
  }

  /**
   * Attempt to dynamically import a plugin from the given path.
   * Returns null on any failure to maintain isolation.
   */
  private async loadFromPath(
    pluginPath: string,
    source: 'directory' | 'npm',
  ): Promise<DiscoveredPlugin | null> {
    try {
      // Try standard index file locations
      const candidates = [
        join(pluginPath, 'index.js'),
        join(pluginPath, 'dist', 'index.js'),
        join(pluginPath, 'index.ts'),
      ];

      let loaded: any = null;
      let resolvedPath = pluginPath;

      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          loaded = await import(candidate);
          resolvedPath = candidate;
          break;
        }
      }

      if (!loaded) {
        this.logger.debug(`No index file found in plugin directory '${pluginPath}'; skipping.`);
        return null;
      }

      // Support both default export and named `plugin` export
      const pluginExport: AuthMePlugin = loaded.default ?? loaded.plugin;

      if (!pluginExport) {
        this.logger.warn(
          `Plugin at '${pluginPath}' does not export a default or named 'plugin' export; skipping.`,
        );
        return null;
      }

      if (!this.validatePlugin(pluginExport)) {
        this.logger.warn(
          `Plugin at '${pluginPath}' failed validation; skipping.`,
        );
        return null;
      }

      this.logger.log(`Discovered plugin '${pluginExport.name}' v${pluginExport.version} from ${source} (${resolvedPath})`);

      return { plugin: pluginExport, source, sourcePath: resolvedPath };
    } catch (err) {
      this.logger.warn(
        `Failed to load plugin from '${pluginPath}': ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Validate that a loaded module satisfies the minimum AuthMePlugin shape.
   */
  validatePlugin(candidate: unknown): candidate is AuthMePlugin {
    if (typeof candidate !== 'object' || candidate === null) return false;

    const p = candidate as Record<string, unknown>;

    if (typeof p['name'] !== 'string' || !p['name']) return false;
    if (typeof p['version'] !== 'string' || !p['version']) return false;
    if (typeof p['type'] !== 'string' || !p['type']) return false;

    const validTypes = ['auth-provider', 'event-listener', 'token-enrichment', 'theme'];
    if (!validTypes.includes(p['type'] as string)) return false;

    return true;
  }
}
