import { Command } from 'commander';
import chalk from 'chalk';
import { HttpClient } from '../http.js';
import { printResult, success } from '../output.js';
import { confirm, askPassword } from '../prompt.js';
import type { UserListResponse } from '../types.js';

export function registerUserCommands(program: Command): void {
  const user = program.command('user').description('Manage users');

  user
    .command('list')
    .description('List users in a realm')
    .requiredOption('--realm <realm>', 'Realm name')
    .option('--skip <skip>', 'Number of records to skip', '0')
    .option('--limit <limit>', 'Max records to return', '50')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = new HttpClient();
      const result = await client.get<UserListResponse>(
        `/admin/realms/${opts.realm}/users`,
        { skip: opts.skip, limit: opts.limit },
      );
      if (!opts.json) {
        console.log(chalk.dim(`Total: ${result.total}`));
        printResult(result.users, opts);
      } else {
        printResult(result, opts);
      }
    });

  user
    .command('create <username>')
    .description('Create a user')
    .requiredOption('--realm <realm>', 'Realm name')
    .option('--email <email>', 'User email')
    .option('--first-name <firstName>', 'First name')
    .option('--last-name <lastName>', 'Last name')
    .option('--password <password>', 'Initial password')
    .option('--disabled', 'Create as disabled')
    .option('--json', 'Output as JSON')
    .action(async (username: string, opts) => {
      const client = new HttpClient();
      const body: Record<string, unknown> = { username };
      if (opts.email) body.email = opts.email;
      if (opts.firstName) body.firstName = opts.firstName;
      if (opts.lastName) body.lastName = opts.lastName;
      if (opts.password) body.password = opts.password;
      if (opts.disabled) body.enabled = false;
      const result = await client.post(`/admin/realms/${opts.realm}/users`, body);
      printResult(result, opts);
    });

  user
    .command('get <id>')
    .description('Get user by ID')
    .requiredOption('--realm <realm>', 'Realm name')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts) => {
      const client = new HttpClient();
      const result = await client.get(`/admin/realms/${opts.realm}/users/${id}`);
      printResult(result, opts);
    });

  user
    .command('delete <id>')
    .description('Delete a user')
    .requiredOption('--realm <realm>', 'Realm name')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (id: string, opts) => {
      if (!opts.yes) {
        const ok = await confirm(`Delete user "${id}"?`);
        if (!ok) {
          console.log('Aborted.');
          return;
        }
      }
      const client = new HttpClient();
      await client.delete(`/admin/realms/${opts.realm}/users/${id}`);
      success(`User "${id}" deleted.`);
    });

  user
    .command('set-password <id>')
    .description('Set a user password')
    .requiredOption('--realm <realm>', 'Realm name')
    .option('--password <password>', 'New password (will prompt if not provided)')
    .action(async (id: string, opts) => {
      const password = opts.password || (await askPassword('New password: '));
      const client = new HttpClient();
      await client.put(`/admin/realms/${opts.realm}/users/${id}/reset-password`, { password });
      success(`Password updated for user "${id}".`);
    });
}
