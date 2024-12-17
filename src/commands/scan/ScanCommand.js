import { BaseCommand } from '../base/BaseCommand.js';
import { ScanHandler } from './handlers/ScanHandler.js';
import { networkState } from '../../services/networkState.js';
import { USER_STATES } from '../../core/constants.js';
import { ErrorHandler } from '../../core/errors/index.js';

export class ScanCommand extends BaseCommand {
  constructor(bot, eventHandler) {
    super(bot);
    this.command = '/scan';
    this.description = 'Scan token details';
    this.pattern = /^(\/scan|🔍 Scan Token)$/;

    this.scanHandler = new ScanHandler(bot);
    this.eventHandler = eventHandler;
    this.registerCallbacks();
  }

  registerCallbacks() {
    this.eventHandler.on('scan_input', async (query) => this.handleScanInput(query));
    this.eventHandler.on('retry_scan', async (query) => this.retryScan(query));
  }

  async execute(msg) {
    const chatId = msg.chat.id;
    try {
      await this.showScanOptions(chatId);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async showScanOptions(chatId) {
    try {
      const currentNetwork = await networkState.getCurrentNetwork(chatId);

      const keyboard = this.createKeyboard([
        [{ text: '📝 Enter Token Address', callback_data: 'scan_input' }],
        [{ text: '🔄 Switch Network', callback_data: 'switch_network' }],
        [{ text: '↩️ Back to Menu', callback_data: '/start' }],
      ]);

      await this.bot.sendMessage(
        chatId,
        `*Token Scanner* 🔍\n\n` +
          `Current Network: *${networkState.getNetworkDisplay(currentNetwork)}*\n\n` +
          'Analyze any token with detailed metrics:\n\n' +
          '• Price & Volume\n' +
          '• LP Value & Distribution\n' +
          '• Security Score & Risks\n' +
          '• Social Links & Info\n\n' +
          'Enter a token address to begin scanning.',
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }
      );
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleScanInput(query) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;

    try {
      await this.setState(userId, USER_STATES.WAITING_SCAN_INPUT);

      await this.bot.sendMessage(
        chatId,
        '*Token Address* 📝\n\n' +
          'Please enter the token contract address you want to scan:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Cancel', callback_data: '/start' }]],
          },
        }
      );
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleCallback(query) {
    const action = query.data;

    try {
      const handled = await this.eventHandler.emit(action, query);
      if (!handled) {
        console.warn(`Unhandled callback action: ${action}`);
      }
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, query.message.chat.id);
    }
  }

  async retryScan(query) {
    const chatId = query.message.chat.id;

    try {
      await this.showScanOptions(chatId);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleInput(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const state = await this.getState(userId);

    if (state === USER_STATES.WAITING_SCAN_INPUT && msg.text) {
      try {
        await this.scanHandler.handleTokenScan(chatId, msg.text.trim(), msg.from);
        await this.clearState(userId);
        return true;
      } catch (error) {
        await ErrorHandler.handle(error, this.bot, chatId);
      }
    }

    return false;
  }
}