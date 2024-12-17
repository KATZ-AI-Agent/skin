import { dextools } from '../../../services/dextools/index.js';
import { networkState } from '../../../services/networkState.js';

export class ScanHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async handleTokenScan(chatId, address, userInfo) {
    const currentNetwork = await networkState.getCurrentNetwork(userInfo.id);
    const loadingMsg = await this.bot.sendMessage(
      chatId, 
      `😼 Scanning token on ${networkState.getNetworkDisplay(currentNetwork)}`
    );
    
    try {
      const analysis = await dextools.formatTokenAnalysis(currentNetwork, address);
      
      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      const keyboard = {
        inline_keyboard: [
          [{ text: '🔄 Scan Another', callback_data: 'scan_input' }],
          [{ text: '🔄 Switch Network', callback_data: 'switch_network' }],
          [{ text: '↩️ Back to Menu', callback_data: '/start' }]
        ]
      };

      await this.bot.sendMessage(chatId, analysis, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: keyboard
      });

      return true;
    } catch (error) {
      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }
      throw error;
    }
  }
}