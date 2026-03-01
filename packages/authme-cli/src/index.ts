import { Command } from 'commander';
import { registerAuthCommands } from './commands/auth.js';
import { registerRealmCommands } from './commands/realm.js';
import { registerUserCommands } from './commands/user.js';
import { registerClientCommands } from './commands/client.js';
import { registerRoleCommands } from './commands/role.js';
import { registerInitCommand } from './commands/init.js';

const program = new Command();

program
  .name('authme')
  .description('CLI for managing an AuthMe IAM server')
  .version('0.1.0');

registerAuthCommands(program);
registerRealmCommands(program);
registerUserCommands(program);
registerClientCommands(program);
registerRoleCommands(program);
registerInitCommand(program);

program.parseAsync(process.argv).catch((err) => {
  if (err.message) console.error(err.message);
  process.exitCode = 1;
});
