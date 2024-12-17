import { ErrorHandler } from '../../../core/errors/index.js';
import { walletService } from '../../../services/wallet/index.js';
import { networkState } from '../../../services/networkState.js';

export class WalletCreationHandler {
  constructor(bot) {
    this.bot = bot;
  }

  /**
   * Show network selection menu
   */
  async showNetworkSelection(chatId, userInfo) {
    try {
      const currentNetwork = await networkState.getCurrentNetwork(userInfo.id);
      const networks = ['ethereum', 'base', 'solana'];

      // Build inline keyboard for network selection
      const keyboard = {
        inline_keyboard: [
          ...networks.map(network => [
            {
              text: network === currentNetwork
                ? `${networkState.getNetworkDisplay(network)} ✓`
                : networkState.getNetworkDisplay(network),
              callback_data: `select_network_${network}`
            }
          ]),
          [{ text: '↩️ Back', callback_data: 'back_to_wallets' }]
        ]
      };

      // Send network selection message
      await this.bot.sendMessage(
        chatId,
        '*Select Network* 🌐\n\nChoose the network for your new wallet:',
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );

      return true;
    } catch (error) {
      console.error('Error showing network selection:', error);
      await ErrorHandler.handle(error, this.bot, chatId);
      return false;
    }
  }

  /**
   * Create a new wallet
   */
  async createWallet(chatId, userInfo, network, showLoadingMessage) {
    const loadingMsg = await showLoadingMessage(chatId, '🔐 Creating your wallet...');

    try {
      // Create a new wallet using the wallet service
      const wallet = await walletService.createWallet(userInfo.id, network);

      // Remove loading message
      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      // Success message with navigation options
      await this.bot.sendMessage(
        chatId,
        `✅ Wallet created successfully!\n\n` +
          `*Network:* ${networkState.getNetworkDisplay(network)}\n` +
          `*Address:* \`${wallet.address}\``,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '👛 View Wallets', callback_data: 'view_wallets' },
                { text: '↩️ Back', callback_data: 'back_to_wallets' }
              ]
            ]
          }
        }
      );

      return true;
    } catch (error) {
      console.error('Error creating wallet:', error);

      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }

      // Handle error gracefully with retry option
      await this.bot.sendMessage(
        chatId,
        '❌ Failed to create wallet. Please try again.',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔄 Retry', callback_data: `select_network_${network}` },
                { text: '↩️ Back', callback_data: 'back_to_wallets' }
              ]
            ]
          }
        }
      );

      return false;
    }
  }
}
