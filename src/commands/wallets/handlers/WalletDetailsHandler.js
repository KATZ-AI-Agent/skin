import { ErrorHandler } from '../../../core/errors/index.js';
import { walletService } from '../../../services/wallet/index.js';
import { networkState } from '../../../services/networkState.js';

export class WalletDetailsHandler {
  constructor(bot) {
    this.bot = bot;
  }

  /**
   * Show wallet details
   */
  async showWalletDetails(chatId, userInfo, address, showLoadingMessage) {
    const loadingMsg = await showLoadingMessage(chatId, '👛 Loading wallet details...');

    try {
      // Fetch wallet with error handling
      const wallet = await walletService.getWallet(userInfo.id, address);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Fetch balance
      let balance;
      try {
        balance = await walletService.getBalance(userInfo.id, address);
      } catch (error) {
        console.error('Balance fetch error:', error);
        balance = 'Error fetching balance';
      }

      // Check if autonomous wallet
      const isAutonomous = await walletService.isAutonomousWallet(
        userInfo.id,
        wallet.network,
        address
      );

      // Remove loading message
      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      // Construct inline keyboard
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: isAutonomous ? '🔴 Remove Autonomous' : '🟢 Set as Autonomous',
              callback_data: `set_autonomous_${address}`
            }
          ],
          [{ text: '↩️ Back', callback_data: 'view_wallets' }]
        ]
      };

      // Send wallet details message
      await this.bot.sendMessage(
        chatId,
        `*Wallet Details* 👛\n\n` +
          `Network: ${networkState.getNetworkDisplay(wallet.network)}\n` +
          `Address: \`${address}\`\n` +
          `Balance: ${balance}\n` +
          `Type: ${wallet.type === 'walletconnect' ? 'External 🔗' : 'Internal 👛'}\n` +
          `Autonomous: ${isAutonomous ? '✅' : '❌'}`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );

      return true;
    } catch (error) {
      console.error('Error showing wallet details:', error);

      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }

      // Handle errors gracefully
      await this.bot.sendMessage(
        chatId,
        '❌ Error loading wallet details. Please try again.',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔄 Retry', callback_data: `wallet_${address}` },
                { text: '↩️ Back', callback_data: 'view_wallets' }
              ]
            ]
          }
        }
      );

      return false;
    }
  }

  /**
   * Set or remove autonomous wallet
   */
  async setAutonomousWallet(chatId, userInfo, address, showLoadingMessage) {
    const loadingMsg = await showLoadingMessage(chatId, '⚙️ Updating wallet settings...');

    try {
      // Update wallet's autonomous status
      await walletService.setAutonomousWallet(userInfo.id, address);

      // Remove loading message
      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      // Notify success
      await this.bot.sendMessage(
        chatId,
        '✅ Autonomous wallet updated successfully!',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '👛 View Wallet', callback_data: `wallet_${address}` },
                { text: '↩️ Back', callback_data: 'view_wallets' }
              ]
            ]
          }
        }
      );

      return true;
    } catch (error) {
      console.error('Error updating autonomous wallet:', error);

      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }

      // Handle error gracefully
      await this.bot.sendMessage(
        chatId,
        '❌ Failed to update wallet settings. Please try again.',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔄 Retry', callback_data: `set_autonomous_${address}` },
                { text: '↩️ Back', callback_data: 'view_wallets' }
              ]
            ]
          }
        }
      );

      return false;
    }
  }
}
