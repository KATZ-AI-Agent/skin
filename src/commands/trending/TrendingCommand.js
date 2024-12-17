import { Command } from '../base/Command.js';
import { dextools } from '../../services/dextools/index.js';
import { networkState } from '../../services/networkState.js';
import { ErrorHandler } from '../../core/errors/index.js';
import { formatTrendingTokens } from './formatters.js';
import { handleTrendingActions } from './handlers/handlers.js';

export class TrendingCommand extends Command {
  constructor(bot) {
    super(bot);
    this.command = '/trending';
    this.description = 'View trending tokens';
    this.pattern = /^(\/trending|🔥 Trending Tokens)$/;
  }

  async execute(msg) {
    const chatId = msg.chat.id;
    try {
      await this.fetchAndDisplayTrending(chatId);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleCallback(query) {
    const { message: { chat: { id: chatId } }, data: action } = query;
    try {
      return await handleTrendingActions(this.bot, action, chatId, () => this.fetchAndDisplayTrending(chatId));
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
      return false;
    }
  }

  async fetchAndDisplayTrending(chatId) {
    const currentNetwork = await networkState.getCurrentNetwork(chatId);
    const loadingMsg = await this.showLoadingMessage(
      chatId,
      `😼 Fetching trending tokens on ${networkState.getNetworkDisplay(currentNetwork)}`
    );

    try {
      const tokens = await dextools.fetchTrendingTokens(currentNetwork);
      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      const keyboard = this.createKeyboard([
        [{ text: '🔄 Refresh', callback_data: 'refresh_trending' }],
        [{ text: '🌐 Switch Network', callback_data: 'switch_network' }],
        [{ text: '🏠 Main Menu', callback_data: '/start' }],
      ]);

      await this.simulateTyping(chatId);
      await this.bot.sendMessage(chatId, formatTrendingTokens(tokens, currentNetwork), {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: keyboard,
      });
    } catch (error) {
      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }
      throw error;
    }
  }
}