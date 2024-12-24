import { CommandRegistry } from './registry.js';
import { ErrorHandler } from '../core/errors/index.js';

export function setupCommands(bot) {
  const registry = new CommandRegistry(bot);
  return registry;
}
