import { EventEmitter } from 'events';
import { ErrorHandler } from './errors/index.js';
import { rateLimiter } from './rate-limiting/RateLimiter.js';
import { circuitBreakers } from './circuit-breaker/index.js';
import { matchIntent } from '../services/ai/intents.js';
import { aiService } from '../services/ai/index.js';
import { contextManager } from '../services/ai/ContextManager.js';

export class MessageHandler extends EventEmitter {
  constructor(bot, commandRegistry) {
    super();
    this.bot = bot;
    this.commandRegistry = commandRegistry;
    this.initialized = false;
    this.processedCallbacks = new Set();
    this.contextManager = contextManager;
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
          return;
        }

        this.processedCallbacks.add(callbackId);
        
        // Cleanup old callback IDs
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        this.processedCallbacks.forEach(id => {
          const timestamp = parseInt(id.split(':')[2]);
          if (timestamp < fiveMinutesAgo) {
            this.processedCallbacks.delete(id);
          }
        });

        await this.handleCallback(query);
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

      // Get user's conversation context
      const context = await this.contextManager.getContext(msg.from.id);
      const isReplyToBot = msg.reply_to_message?.from?.id === this.bot.id;
      const isKatzMention = msg.text.toLowerCase().includes('katz');

      // Handle AI conversation if:
      // 1. Message is a reply to bot
      // 2. Message mentions KATZ
      // 3. There's active conversation context
      if (isReplyToBot || isKatzMention || context.length > 0) {
        return this.handleAIResponse(msg, null, context);
      }

      // Check for command matches
      const command = this.commandRegistry.findCommand(msg.text);
      if (command) {
        await command.execute(msg);
        return;
      }

      // Check for intent matches
      const matchedIntent = matchIntent(msg.text);
      if (matchedIntent) {
        return this.handleAIResponse(msg, matchedIntent, context);
      }

      // Handle state-based input
      for (const cmd of this.commandRegistry.getCommands()) {
        if (cmd.handleInput && await cmd.handleInput(msg)) {
          return;
        }
      }

      // If no other handlers matched, treat as general chat
      return this.handleAIResponse(msg, null, context);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, msg.chat.id);
    }
  }

  async handleAIResponse(msg, intent = null, context = []) {
    const loadingMsg = await this.bot.sendMessage(
      msg.chat.id,
      '🤖 Processing your request...'
    );

    try {
      const response = await aiService.processCommand(
        msg.text,
        intent,
        msg.from.id,
        context
      );

      await this.bot.deleteMessage(msg.chat.id, loadingMsg.message_id);

      // Send response with reply markup to encourage conversation
      const sentMessage = await this.bot.sendMessage(msg.chat.id, response.text, {
        parse_mode: 'Markdown',
        reply_markup: {
          force_reply: true,
          selective: true
        }
      });

      // Update conversation context
      await this.contextManager.updateContext(
        msg.from.id,
        msg.text,
        response.text
      );

      // Handle any follow-up actions
      if (response.actions) {
        await this.handleAIActions(msg.chat.id, response.actions);
      }

      return sentMessage;
    } catch (error) {
      if (loadingMsg) {
        await this.bot.deleteMessage(msg.chat.id, loadingMsg.message_id);
      }
      await ErrorHandler.handle(error, this.bot, msg.chat.id);
    }
  }

  async handleCallback(query) {
    try {
      const handled = await this.commandRegistry.handleCallback(query);
      
      if (handled) {
        await this.bot.answerCallbackQuery(query.id);
      } else {
        console.warn('⚠️ Unhandled callback:', query.data);
        await this.bot.answerCallbackQuery(query.id, {
          text: '⚠️ Action not recognized.',
          show_alert: false
        });
      }
    } catch (error) {
      await this.bot.answerCallbackQuery(query.id, {
        text: '❌ An error occurred',
        show_alert: false
      });
      await ErrorHandler.handle(error, this.bot, query.message?.chat?.id);
    }
  }

  cleanup() {
    this.bot.removeAllListeners();
    this.removeAllListeners();
    this.processedCallbacks.clear();
    this.contextManager.cleanup();
    this.initialized = false;
  }
}