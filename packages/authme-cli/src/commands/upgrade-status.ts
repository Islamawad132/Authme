import { Command } from 'commander';
import chalk from 'chalk';
import { HttpClient } from '../http.js';

interface UpgradeAuditEntry {
  id: string;
  action: 'started' | 'completed' | 'failed' | 'rolled_back';
  version: string;
  timestamp: string;
  triggeredBy: string | null;
  duration: number | null;
  migrationsApplied: string[];
  errorMessage: string | null;
  rollbackPerformed: boolean;
}

interface UpgradeAuditResponse {
  entries: UpgradeAuditEntry[];
  total: number;
}

export function registerUpgradeStatusCommand(program: Command): void {
  program
    .command('upgrade:status')
    .description('View upgrade audit history')
    .option('--json', 'Output results as JSON')
    .option('--limit <number>', 'Maximum number of entries to show', '20')
    .action(async (opts: { json?: boolean; limit?: string }) => {
      console.log(chalk.bold('\n  AuthMe Upgrade Status\n'));

      // ------------------------------------------------------------------ //
      // Step 1: Server connectivity check                                   //
      // ------------------------------------------------------------------ //
      process.stdout.write(chalk.dim('  Checking server connectivity... '));
      try {
        const client = new HttpClient();
        await client.get<{ version: string }>('/admin/system/version');
        console.log(chalk.green('OK'));
      } catch {
        console.log(chalk.red('FAILED'));
        console.error(chalk.red('\n  Cannot connect to the AuthMe server.'));
        console.error(chalk.dim('  Make sure the server is running and `authme config set-url` is correct.\n'));
        process.exitCode = 1;
        return;
      }

      // ------------------------------------------------------------------ //
      // Step 2: Fetch audit history                                         //
      // ------------------------------------------------------------------ //
      process.stdout.write(chalk.dim('  Fetching upgrade audit history... '));
      let auditData: UpgradeAuditResponse;
      try {
        const client = new HttpClient();
        const limitNum = Math.min(Math.max(parseInt(opts.limit ?? '20', 10), 1), 100);
        auditData = await client.get<UpgradeAuditResponse>(
          '/admin/upgrade/audit',
          { limit: String(limitNum) },
        );
        console.log(chalk.green('OK'));
      } catch (fetchError) {
        console.log(chalk.red('FAILED'));
        console.error(chalk.red('\n  Failed to retrieve upgrade audit history.'));
        console.error(chalk.dim(`  Error: ${String(fetchError)}\n`));
        process.exitCode = 1;
        return;
      }

      // ------------------------------------------------------------------ //
      // Step 3: Display results                                             //
      // ------------------------------------------------------------------ //
      const { entries, total } = auditData;

      if (opts.json) {
        console.log(JSON.stringify(auditData, null, 2));
        return;
      }

      if (entries.length === 0) {
        console.log(chalk.dim('\n  No upgrade audit entries found.\n'));
        return;
      }

      console.log(chalk.dim(`  Showing ${entries.length} of ${total} entries\n`));

      // Table header
      const header = [
        chalk.bold('TIMESTAMP'.padEnd(22)),
        chalk.bold('ACTION'.padEnd(12)),
        chalk.bold('VERSION'.padEnd(10)),
        chalk.bold('MIGRATIONS'.padEnd(15)),
        chalk.bold('STATUS'),
      ].join('  ');
      console.log(header);
      console.log(chalk.dim('  ' + '-'.repeat(80)));

      // Table rows
      for (const entry of entries) {
        const timestamp = formatTimestamp(entry.timestamp);
        const action = formatAction(entry.action);
        const version = entry.version || chalk.dim('(none)');
        const migrations = entry.migrationsApplied.length > 0
          ? entry.migrationsApplied.slice(-2).join(', ') + (entry.migrationsApplied.length > 2 ? '...' : '')
          : chalk.dim('(none)');
        const status = formatStatus(entry);

        console.log(
          `  ${chalk.dim(timestamp)}  ${action}  ${version.padEnd(10)}  ${chalk.dim(migrations.substring(0, 15).padEnd(15))}  ${status}`,
        );

        // Show error message if present
        if (entry.errorMessage) {
          console.log(chalk.red(`    └─ Error: ${entry.errorMessage.substring(0, 60)}${entry.errorMessage.length > 60 ? '...' : ''}`));
        }

        // Show rollback indicator if applicable
        if (entry.rollbackPerformed) {
          console.log(chalk.yellow(`    └─ Rollback performed`));
        }
      }

      console.log(chalk.dim('  ' + '-'.repeat(80)));
      console.log(`  Total entries: ${chalk.bold(String(total))}\n`);
    });
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function formatAction(action: UpgradeAuditEntry['action']): string {
  switch (action) {
    case 'started':
      return chalk.blue('STARTED');
    case 'completed':
      return chalk.green('COMPLETED');
    case 'failed':
      return chalk.red('FAILED');
    case 'rolled_back':
      return chalk.yellow('ROLLED_BACK');
    default:
      return chalk.dim('UNKNOWN');
  }
}

function formatStatus(entry: UpgradeAuditEntry): string {
  if (entry.action === 'completed') {
    const duration = entry.duration ? ` (${entry.duration}ms)` : '';
    return chalk.green(`✓ Success${duration}`);
  }
  if (entry.action === 'failed') {
    return chalk.red('✗ Failed');
  }
  if (entry.action === 'rolled_back') {
    return chalk.yellow('↩ Rolled back');
  }
  if (entry.action === 'started') {
    return chalk.blue('● In progress');
  }
  return chalk.dim('?');
}