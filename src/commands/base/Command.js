import { UserState } from '../../utils/userState.js';
import { createKeyboard } from '../../utils/keyboard.js';
import { ERROR_MESSAGES } from '../../core/constants.js';
import { ErrorHandler } from '../../core/errors/index.js';

export class Command {
  constructor(bot) {
    if (new.target === Command) {
      throw new Error('Command is an abstract class');
    }
    this.bot = bot;
    this.command = '';
    this.description = '';
    this.pattern = null;
  }

  async safeExecute(msg) {
    try {
      await this.execute(msg);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, msg.chat.id);
    }
  }

  async execute(msg) {
    throw new Error('Command execute method must be implemented');
  }

  async handleCallback(query) {
    return false;
  }

  async handleInput(msg) {
    return false;
  }

  createKeyboard(buttons, options = {}) {
    return createKeyboard(buttons, options);
  }

  async showErrorMessage(chatId, error, retryAction = null) {
    const keyboard = this.createKeyboard([[
      retryAction ? { text: '🔄 Retry', callback_data: retryAction } : null,
      { text: '↩️ Back to Menu', callback_data: '/start' }
    ].filter(Boolean)]);

    const errorMessage = ERROR_MESSAGES[error?.code] || error?.message || ERROR_MESSAGES.GENERAL_ERROR;

    try {
      await this.bot.sendMessage(chatId, errorMessage, { 
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });
    } catch (notifyError) {
      await ErrorHandler.handle(notifyError, this.bot, chatId);
    }
  }

  async showLoadingMessage(chatId, message = '😼 Processing...') {
    return this.bot.sendMessage(chatId, message);
  }

  async deleteMessage(chatId, messageId) {
    try {
      await this.bot.deleteMessage(chatId, messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  }

  async simulateTyping(chatId, duration = 3000) {
    await this.bot.sendChatAction(chatId, 'typing');
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  // State management helpers
  async setState(userId, state) {
    return UserState.setState(userId, state);
  }

  async getState(userId) {
    return UserState.getState(userId);
  }

  async clearState(userId) {
    return UserState.clearUserState(userId);
  }

  async setUserData(userId, data) {
    return UserState.setUserData(userId, data);
  }

  async getUserData(userId) {
    return UserState.getUserData(userId);
  }
}