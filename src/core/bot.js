import TelegramBot from 'node-telegram-bot-api';
import { config } from './config.js';
import { circuitBreakers } from './circuit-breaker/index.js';
import { rateLimiter } from './rate-limiting/RateLimiter.js';

class Bot {
  constructor() {
    if (Bot.instance) {
      return Bot.instance;
    }

    // Initialize bot with optimized polling settings
    this.instance = new TelegramBot(config.botToken, {
      polling: false // Start with polling disabled
    });

    // Store instance
    Bot.instance = this;
    return this;
  }

  async startPolling() {
    try {
      // Configure polling options
      const pollingOptions = {
        interval: 1000, // Poll every second
        params: {
          timeout: 10, // Long polling timeout
          limit: 100,  // Get up to 100 updates per poll
          allowed_updates: ['message', 'callback_query'] // Only get necessary updates
        }
      };

      // Start polling with circuit breaker protection
      await circuitBreakers.executeWithBreaker('polling', async () => {
        await this.instance.startPolling(pollingOptions);
        console.log('✅ Bot polling started successfully');
      });

      // Set up error handler for polling errors
      this.instance.on('polling_error', async (error) => {
        console.error('Polling error:', error);
        
        // Check rate limit
        /*
        const isLimited = await rateLimiter.isRateLimited('bot', 'polling');
        if (isLimited) {
          console.warn('Bot polling rate limited. Waiting...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        */

        // Attempt to restart polling if needed
        if (!this.instance.isPolling()) {
          console.log('🔄 Attempting to restart polling...');
          await this.startPolling();
        }
      });

      return true;
    } catch (error) {
      console.error('Failed to start polling:', error);
      throw error;
    }
  }

  async stopPolling() {
    try {
      if (this.instance.isPolling()) {
        await this.instance.stopPolling();
        console.log('✅ Bot polling stopped successfully');
      }
    } catch (error) {
      console.error('Error stopping polling:', error);
      throw error;
    }
  }

  getInstance() {
    return this.instance;
  }

  async cleanup() {
    await this.stopPolling();
    this.instance.removeAllListeners();
  }
}

// Export singleton instance
export const bot = new Bot().getInstance();

// Handle cleanup on process termination
process.on('SIGINT', async () => {
  await bot.cleanup();
});

process.on('SIGTERM', async () => {
  await bot.cleanup();
});