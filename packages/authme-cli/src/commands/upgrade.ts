import { Command } from 'commander';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { HttpClient } from '../http.js';
import { success, warn } from '../output.js';
import { confirm } from '../prompt.js';

interface VersionResponse {
  version: string;
  schemaVersion: string | null;
  pendingMigrations: string[];
  databaseUpToDate: boolean;
}

export function registerUpgradeCommand(program: Command): void {
  program
    .command('upgrade')
    .description('Upgrade AuthMe: run pre-flight checks then apply database migrations')
    .option('--dry-run', 'Preview what would change without applying')
    .option('--rollback', 'Roll back the last applied database migration')
    .option('--yes', 'Skip confirmation prompts')
    .option('--json', 'Output results as JSON')
    .action(async (opts: { dryRun?: boolean; rollback?: boolean; yes?: boolean; json?: boolean }) => {
      const isDryRun = Boolean(opts.dryRun);
      const isRollback = Boolean(opts.rollback);

      console.log(chalk.bold('\n  AuthMe Upgrade\n'));

      // ------------------------------------------------------------------ //
      // Step 1: Pre-flight – server connectivity                             //
      // ------------------------------------------------------------------ //
      process.stdout.write(chalk.dim('  Checking server connectivity... '));
      let versionInfo: VersionResponse;
      try {
        const client = new HttpClient();
        versionInfo = await client.get<VersionResponse>('/admin/system/version');
        console.log(chalk.green('OK'));
      } catch {
        console.log(chalk.red('FAILED'));
        console.error(chalk.red('\n  Cannot connect to the AuthMe server.'));
        console.error(chalk.dim('  Make sure the server is running and `authme config set-url` is correct.\n'));
        process.exitCode = 1;
        return;
      }

      // ------------------------------------------------------------------ //
      // Step 2: Pre-flight – display current version                        //
      // ------------------------------------------------------------------ //
      console.log(`  Server version      : ${chalk.bold(versionInfo.version)}`);
      console.log(
        `  Database schema     : ${
          versionInfo.schemaVersion
            ? chalk.bold(versionInfo.schemaVersion)
            : chalk.dim('(none)')
        }`,
      );

      // ------------------------------------------------------------------ //
      // Step 3: Pre-flight – migration status                               //
      // ------------------------------------------------------------------ //
      if (isRollback) {
        await handleRollback({ isDryRun, skipConfirm: Boolean(opts.yes), isJson: Boolean(opts.json) });
        return;
      }

      if (versionInfo.databaseUpToDate) {
        success('\n  Database is already up to date. Nothing to migrate.');
        return;
      }

      const { pendingMigrations } = versionInfo;
      console.log(`\n  Pending migrations (${chalk.yellow(String(pendingMigrations.length))}):`);
      for (const m of pendingMigrations) {
        console.log(`    ${chalk.cyan('→')} ${m}`);
      }

      if (isDryRun) {
        console.log(chalk.dim('\n  Dry run complete — no changes applied.'));
        if (opts.json) {
          console.log(JSON.stringify({ dryRun: true, pendingMigrations }, null, 2));
        }
        return;
      }

      // ------------------------------------------------------------------ //
      // Step 4: Confirm + apply                                             //
      // ------------------------------------------------------------------ //
      if (!opts.yes) {
        const ok = await confirm(
          `\n  Apply ${pendingMigrations.length} migration(s) now?`,
        );
        if (!ok) {
          console.log(chalk.dim('  Aborted.'));
          return;
        }
      }

      console.log(chalk.dim('\n  Running: prisma migrate deploy\n'));
      try {
        const output = execSync('npx prisma migrate deploy', {
          encoding: 'utf-8',
          stdio: ['inherit', 'pipe', 'pipe'],
        });
        console.log(output);
        success('  Migrations applied successfully.');

        if (opts.json) {
          console.log(JSON.stringify({ applied: pendingMigrations }, null, 2));
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error && 'stderr' in err
            ? String((err as NodeJS.ErrnoException & { stderr?: Buffer }).stderr)
            : String(err);
        console.error(chalk.red('\n  Migration failed:\n'));
        console.error(chalk.red(msg));
        process.exitCode = 1;
      }
    });
}

// -------------------------------------------------------------------------- //
// Rollback handler                                                            //
// -------------------------------------------------------------------------- //

async function handleRollback(opts: {
  isDryRun: boolean;
  skipConfirm: boolean;
  isJson: boolean;
}): Promise<void> {
  warn('  Rolling back the last migration using `prisma migrate resolve --rolled-back <name>`.');
  console.log(chalk.dim('  Determining last applied migration...\n'));

  let statusOutput: string;
  try {
    statusOutput = execSync('npx prisma migrate status 2>&1', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err: unknown) {
    statusOutput =
      err instanceof Error && 'stdout' in err
        ? String((err as NodeJS.ErrnoException & { stdout?: Buffer }).stdout)
        : '';
  }

  // Find the last line that shows an applied migration (✓ or ✔)
  const applied = (statusOutput.match(/[✓✔]\s+(\S+)/g) ?? [])
    .map((m) => m.replace(/^[✓✔]\s+/, ''));

  if (applied.length === 0) {
    console.error(chalk.red('  No applied migrations found to roll back.'));
    process.exitCode = 1;
    return;
  }

  const lastMigration = applied[applied.length - 1];
  console.log(`  Last applied migration : ${chalk.bold(lastMigration)}`);

  if (opts.isDryRun) {
    console.log(chalk.dim(`\n  Dry run — would roll back: ${lastMigration}`));
    if (opts.isJson) {
      console.log(JSON.stringify({ dryRun: true, wouldRollback: lastMigration }, null, 2));
    }
    return;
  }

  if (!opts.skipConfirm) {
    const ok = await confirm(`\n  Roll back migration "${lastMigration}"?`);
    if (!ok) {
      console.log(chalk.dim('  Aborted.'));
      return;
    }
  }

  console.log(chalk.dim(`\n  Running: prisma migrate resolve --rolled-back ${lastMigration}\n`));
  try {
    const out = execSync(
      `npx prisma migrate resolve --rolled-back ${lastMigration}`,
      { encoding: 'utf-8', stdio: ['inherit', 'pipe', 'pipe'] },
    );
    console.log(out);
    success(`  Rolled back migration "${lastMigration}".`);

    if (opts.isJson) {
      console.log(JSON.stringify({ rolledBack: lastMigration }, null, 2));
    }
  } catch (err: unknown) {
    const msg =
      err instanceof Error && 'stderr' in err
        ? String((err as NodeJS.ErrnoException & { stderr?: Buffer }).stderr)
        : String(err);
    console.error(chalk.red('\n  Rollback failed:\n'));
    console.error(chalk.red(msg));
    process.exitCode = 1;
  }
}
