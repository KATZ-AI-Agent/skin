import { EventEmitter } from 'events';
import { ErrorHandler } from './errors/index.js';
import { rateLimiter } from './rate-limiting/RateLimiter.js';
import { circuitBreakers } from './circuit-breaker/index.js';

export class MessageHandler extends EventEmitter {
  constructor(bot, commandRegistry) {
    super();
    this.bot = bot;
    this.commandRegistry = commandRegistry;
    this.initialized = false;
    this.processedCallbacks = new Set(); // Track processed callbacks
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Setup message handler with rate limiting and circuit breaker
      this.bot.on('message', async (msg) => {
        await circuitBreakers.executeWithBreaker('messages', async () => {
          const isLimited = await rateLimiter.isRateLimited(msg.from.id, 'message');
          if (isLimited) {
            await this.bot.sendMessage(msg.chat.id, '⚠️ Please slow down! Try again in a minute.');
            return;
          }

          await this.handleMessage(msg);
        });
      });

      // Setup callback query handler with deduplication
      this.bot.on('callback_query', async (query) => {
        const callbackId = `${query.from.id}:${query.data}:${Date.now()}`;
        
        if (this.processedCallbacks.has(callbackId)) {
          return; // Skip if already processed
        }

        this.processedCallbacks.add(callbackId);
        
        // Cleanup old callback IDs (keep last 5 minutes)
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        this.processedCallbacks.forEach(id => {
          const timestamp = parseInt(id.split(':')[2]);
          if (timestamp < fiveMinutesAgo) {
            this.processedCallbacks.delete(id);
          }
        });

        await circuitBreakers.executeWithBreaker('messages', async () => {
          const isLimited = await rateLimiter.isRateLimited(query.from.id, 'callback');
          if (isLimited) {
            await this.bot.answerCallbackQuery(query.id, {
              text: '⚠️ Too many requests! Please wait.',
              show_alert: true
            });
            return;
          }

          await this.handleCallback(query);
        });
      });

      this.initialized = true;
      console.log('✅ MessageHandler initialized successfully');
    } catch (error) {
      console.error('❌ Error during MessageHandler initialization:', error);
      throw error;
    }
  }

  async handleMessage(msg) {
    try {
      if (!msg.text) return;

      const command = this.commandRegistry.findCommand(msg.text);
      if (command) {
        await command.execute(msg);
        return;
      }

      // Handle state-based input
      for (const cmd of this.commandRegistry.getCommands()) {
        if (cmd.handleInput && await cmd.handleInput(msg)) {
          return;
        }
      }
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, msg.chat.id);
    }
  }

  async handleCallback(query) {
    try {
      console.log('📥 Processing callback:', query.data);
      
      const handled = await this.commandRegistry.handleCallback(query);
      
      if (handled) {
        await this.bot.answerCallbackQuery(query.id);
      } else {
        console.warn('⚠️ Unhandled callback:', query.data);
        await this.bot.answerCallbackQuery(query.id, {
          text: '⚠️ Action not recognized.',
          show_alert: true
        });
      }
    } catch (error) {
      console.error('❌ Error in callback handler:', error);
      await this.bot.answerCallbackQuery(query.id, {
        text: '❌ An error occurred',
        show_alert: true
      });
      await ErrorHandler.handle(error, this.bot, query.message?.chat?.id);
    }
  }

  cleanup() {
    this.bot.removeAllListeners();
    this.removeAllListeners();
    this.processedCallbacks.clear();
    this.initialized = false;
  }
}