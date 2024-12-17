import { ErrorTypes, BaseError } from './ErrorTypes.js';
import { healthMonitor } from '../health/HealthMonitor.js';

export class ErrorHandler {
  /**
   * Handles errors globally with optional user notification.
   * @param {Error} error - The error to handle.
   * @param {Object|null} bot - (Optional) Telegram bot instance for user notification.
   * @param {number|null} chatId - (Optional) Chat ID for user notification.
   * @returns {Promise<Object>} - Details of the handled error.
   */
  static async handle(error, bot = null, chatId = null) {
    console.error('❌ Error occurred:', error);

    // Determine error type and map to a user-friendly message
    const errorMessages = this._getErrorMessages();
    const message = errorMessages[error.type] || errorMessages['DEFAULT'];

    // Notify the user if bot and chatId are available
    if (bot && chatId) {
      await this._notifyUser(bot, chatId, message);
    }

    // Log error for monitoring purposes
    healthMonitor.logError(error);

    // Handle specific error types or critical errors
    if (error instanceof BaseError && error.isCritical) {
      console.error('🚨 Critical error detected:', error.message);
      await this._handleCriticalError(error);
    } else if (error instanceof AggregateError) {
      console.error('📚 Handling AggregateError with multiple sub-errors');
      for (const subError of error.errors) {
        console.error('Sub-error:', subError);
        await this.handle(subError, bot, chatId); // Recursive handling of sub-errors
      }
    } else {
      console.warn('Non-critical error handled:', error.message);
    }

    return { message: error.message, stack: error.stack };
  }

  /**
   * Maps known error types to user-friendly messages.
   * @returns {Object} A mapping of error types to messages.
   */
  static _getErrorMessages() {
    return {
      [ErrorTypes.RATE_LIMIT]: '⚠️ You are sending too many requests. Please wait a moment.',
      [ErrorTypes.NETWORK]: '❌ Network error. Please check your connection.',
      [ErrorTypes.DATABASE]: '❌ Service temporarily unavailable.',
      [ErrorTypes.VALIDATION]: '❌ Invalid input. Please check your data.',
      [ErrorTypes.AUTH]: '❌ Authentication failed. Please try again.',
      [ErrorTypes.WALLET]: '❌ Wallet operation failed. Please check your settings.',
      [ErrorTypes.API]: '❌ External service error. Please try again later.',
      [ErrorTypes.POLLING]: '⚠️ Polling error occurred. Retrying automatically.',
      'DEFAULT': '❌ An unexpected error occurred. Please try again later.',
    };
  }

  /**
   * Notify a user in the Telegram chat with an error message.
   * @param {Object} bot - The Telegram bot instance.
   * @param {number} chatId - The chat ID to send the message.
   * @param {string} message - The message to send.
   */
  static async _notifyUser(bot, chatId, message) {
    try {
      await bot.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [[
            { text: '🔄 Retry', callback_data: 'retry_action' },
            { text: '↩️ Back to Menu', callback_data: '/start' }
          ]]
        }
      });
    } catch (notifyError) {
      console.error('Error notifying user:', notifyError);
    }
  }

  /**
   * Handle critical errors by logging and possibly restarting the bot or services.
   * @param {BaseError} error - The critical error object.
   */
  static async _handleCriticalError(error) {
    console.error('🔧 Handling critical error:', error);

    // Restart or notify admin logic here
    // Example: healthMonitor.notifyAdmins(error);
    healthMonitor.logCriticalError(error);

    // Consider shutting down or restarting specific services
    // Example:
    // process.exit(1); // Uncomment this for critical unrecoverable issues
  }

  /**
   * Log and handle uncaught exceptions and unhandled promise rejections.
   */
  static initializeGlobalHandlers() {
    process.on('uncaughtException', async (error) => {
      console.error('❌ Uncaught Exception:', error);
      await ErrorHandler.handle(error);
      // Optionally, decide whether to exit the process for unrecoverable errors
      // process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      console.error('❌ Unhandled Promise Rejection:', reason);
      await ErrorHandler.handle(reason);
    });
  }
}

/**
 * Utility function to safely execute async functions with centralized error handling.
 * @param {Function} fn - The async function to execute.
 * @param {...any} args - Arguments to pass to the function.
 */
export async function safeExecute(fn, ...args) {
  try {
    return await fn(...args);
  } catch (error) {
    await ErrorHandler.handle(error);
    console.error('Error during execution:', error);
    return null; // Return a fallback value or null
  }
}
