/**
 * app-version.ts
 *
 * Reads the application version from package.json at module load time.
 * Using readFileSync + JSON.parse avoids the `import.meta.url` / createRequire
 * pattern that conflicts with Jest's CommonJS transform.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

function readAppVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', '..', 'package.json');
    const raw = readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const APP_VERSION = readAppVersion();
