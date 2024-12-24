import { EventEmitter } from 'events';
import { UserState } from '../../utils/userState.js';
import { createKeyboard } from '../../utils/keyboard.js';
import { ErrorHandler } from '../../core/errors/index.js';

export class BaseCommand extends EventEmitter {
  constructor(bot) {
    super();
    if (new.target === BaseCommand) {
      throw new Error('BaseCommand is an abstract class');
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
    await ErrorHandler.handle(error, this.bot, chatId, retryAction);
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