import { Command } from '../base/Command.js';
import { trendingService } from '../../services/trending/TrendingService.js';
import { networkState } from '../../services/networkState.js';
import { ErrorHandler } from '../../core/errors/index.js';
import { formatTrendingTokens, formatAsciiArt } from './formatters.js';

export class TrendingCommand extends Command {
  constructor(bot) {
    super(bot);
    this.command = '/trending';
    this.description = 'Dextools & Dexscreener Trending Tokens';
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

  async fetchAndDisplayTrending(chatId) {
    const currentNetwork = await networkState.getCurrentNetwork(chatId);
    const loadingMsg = await this.showLoadingMessage(
      chatId,
      `😼 Fetching trending tokens on ${networkState.getNetworkDisplay(currentNetwork)}`
    );

    try {
      await this.simulateTyping(chatId);

      // Fetch data from both sources
      const [trendingTokens, boostedTokens] = await Promise.all([
        trendingService.getTrendingTokens(currentNetwork),
        trendingService.getBoostedTokens()
      ]);

      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      const keyboard = this.createKeyboard([
        [{ text: '🔄 Refresh', callback_data: 'refresh_trending' }],
        [{ text: '🌐 Switch Network', callback_data: 'switch_network' }],
        [{ text: '🚀 Show Boosted', callback_data: 'trending_boosted' }],
        [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }],
      ]);

      // Header ASCII art for trending tokens
      await this.bot.sendMessage(
        chatId,
        formatAsciiArt('trending'),
        { parse_mode: 'HTML', disable_web_page_preview: true }
      );

      // Trending tokens section
      await this.bot.sendMessage(
        chatId,
        formatTrendingTokens(trendingTokens, currentNetwork),
        {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: keyboard
        }
      );

      // Separator ASCII art before boosted tokens
      await this.bot.sendMessage(chatId, `\n\n${formatAsciiArt('separator')}`, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });

      // Boosted tokens section
      await this.bot.sendMessage(
        chatId,
        `🚀 *Boosted Tokens*\n\n${formatTrendingTokens(boostedTokens, 'all', true)}`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
    } catch (error) {
      if (loadingMsg) await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      throw error;
    }
  }

  async handleCallback(query) {
    const chatId = query.message.chat.id;
    const action = query.data;

    try {
      switch (action) {
        case 'refresh_trending':
          await this.fetchAndDisplayTrending(chatId);
          break;
        case 'trending_boosted':
          await this.showBoostedTokens(chatId);
          break;
        case 'back_to_trending':
          await this.fetchAndDisplayTrending(chatId);
          break;
        default:
          console.warn(`Unhandled callback action: ${action}`);
      }
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async showBoostedTokens(chatId) {
    const loadingMsg = await this.showLoadingMessage(chatId, '🚀 Fetching boosted tokens...');

    try {
      await this.simulateTyping(chatId);
      const boostedTokens = await trendingService.getBoostedTokens();
      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      // Header ASCII art for boosted tokens
      await this.bot.sendMessage(chatId, formatAsciiArt('boosted'), {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });

      // Boosted tokens section
      await this.bot.sendMessage(
        chatId,
        formatTrendingTokens(boostedTokens, 'all', true),
        {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Refresh', callback_data: 'trending_boosted' }],
              [{ text: '↩️ Back', callback_data: 'back_to_trending' }]
            ]
          }
        }
      );
    } catch (error) {
      if (loadingMsg) await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      throw error;
    }
  }
}
