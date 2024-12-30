import { EventEmitter } from 'events';
import { ErrorHandler } from '../../core/errors/index.js';

export class RetryManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 10000;
  }

  async executeWithRetry(operation, context = {}) {
    let attempt = 0;
    let lastError;

    while (attempt < this.maxRetries) {
      try {
        return await operation();
      } catch (error) {
        attempt++;
        lastError = error;

        if (attempt === this.maxRetries) {
          break;
        }

        const delay = Math.min(
          this.baseDelay * Math.pow(2, attempt),
          this.maxDelay
        );

        this.emit('retry', {
          attempt,
          error,
          delay,
          context
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.emit('maxRetriesReached', {
      attempts: attempt,
      error: lastError,
      context
    });

    await ErrorHandler.handle(lastError);
    throw lastError;
  }
}

export const retryManager = new RetryManager();