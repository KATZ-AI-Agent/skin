import { EventEmitter } from 'events';
import { ErrorHandler } from '../core/errors/index.js';

export class CommandRegistry extends EventEmitter {
  constructor(bot) {
    super();
    this.bot = bot;
    this.commands = new Map();
    this.messageHandler = null;
    this.initialized = false;
    this.callbackHandlers = new Map();
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Register global callback handlers
      this.registerGlobalCallbacks();

      const commandList = Array.from(this.commands.values()).map(cmd => ({
        command: cmd.command.replace('/', ''),
        description: cmd.description
      }));

      await this.bot.setMyCommands(commandList);

      this.initialized = true;
      console.log('✅ CommandRegistry initialized with', this.commands.size, 'commands');
      return true;
    } catch (error) {
      console.error('❌ Error initializing CommandRegistry:', error);
      throw error;
    }
  }

  registerCommand(command) {
    if (!command.command || !command.description) {
      throw new Error('Invalid command format');
    }

    this.commands.set(command.command, command);
    
    // Register command's callback handlers
    if (command.getCallbackHandlers) {
      const handlers = command.getCallbackHandlers();
      handlers.forEach((handler, action) => {
        this.callbackHandlers.set(action, handler.bind(command));
      });
    }

    console.log(`✅ Registered command: ${command.command}`);
  }

  registerGlobalCallbacks() {
    // Register common callbacks that should work across all commands
    const globalCallbacks = [
      'back_to_menu',
      'switch_network',
      'retry_action',
      'wallet_settings',
      'view_wallets',
      '/^wallet_/',
      'start/'
    ];

    globalCallbacks.forEach(action => {
      this.callbackHandlers.set(action, async (query) => {
        const command = this.findCommandForCallback(action);
        if (command) {
          return command.handleCallback(query);
        }
        return false;
      });
    });
  }

  findCommandForCallback(action) {
    // Find the appropriate command to handle the callback
    for (const command of this.commands.values()) {
      if (command.canHandleCallback && command.canHandleCallback(action)) {
        return command;
      }
    }
    return null;
  }

  // src/commands/registry.js
async handleCallback(query) {
  try {
    const { data: action } = query;
    console.log('🔄 Processing callback:', action);

    // Check for registered callback handler
    const handler = this.callbackHandlers.get(action);
    if (handler) {
      return await handler(query);
    }

    // Find command that can handle this callback
    for (const command of this.commands.values()) {
      if (command.handleCallback) {
        const handled = await command.handleCallback(query);
        if (handled) {
          console.log('✅ Callback handled by command:', command.command);
          return true;
        }
      }
    }

    // This is causing the unrecognized action message
    console.warn('⚠️ No handler found for callback:', action);
    return false;
  } catch (error) {
    console.error('❌ Error in callback handler:', error);
    await ErrorHandler.handle(error, this.bot, query.message?.chat?.id);
    return false;
  }
}


  findCommand(text) {
    // First try exact command match
    const command = this.commands.get(text.split(' ')[0]);
    if (command) return command;

    // Then try pattern match
    for (const cmd of this.commands.values()) {
      if (cmd.pattern?.test(text)) return cmd;
    }

    return null;
  }

  getCommands() {
    return Array.from(this.commands.values());
  }

  cleanup() {
    this.commands.clear();
    this.callbackHandlers.clear();
    this.removeAllListeners();
    this.initialized = false;
  }
}