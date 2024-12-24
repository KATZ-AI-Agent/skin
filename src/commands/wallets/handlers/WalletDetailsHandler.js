import { walletService } from '../../../services/wallet/index.js';
import { tokenService } from '../../../services/wallet/TokenService.js';
import { networkState } from '../../../services/networkState.js';
import { formatBalance } from '../utils/formatters.js';
import { ErrorHandler } from '../../../core/errors/index.js';

export class WalletDetailsHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async showLoadingMessage(chatId, message) {
    return this.bot.sendMessage(chatId, message);
  }

  async showWalletDetails(chatId, userInfo, address) {
    const loadingMsg = await this.showLoadingMessage(chatId, '👛 Loading wallet details...');

    try {
        // Get wallet info
        const wallet = await walletService.getWallet(userInfo.id, address);
        if (!wallet) {
            throw new Error('Wallet not found.');
        }

        // Fetch token balances based on the network
        let tokenBalances = [];
        if (wallet.network === 'ethereum' || wallet.network === 'base') {
            tokenBalances = await tokenService.getEvmTokenBalances(wallet.network, address);
        } else if (wallet.network === 'solana') {
            tokenBalances = await tokenService.getSolanaTokenBalances(address);
        }

        // Format the wallet message
        const tokenCount = tokenBalances.length;
        const message = this.formatWalletDetails(wallet, tokenCount);

        // Create token buttons with simplified callback data
        const keyboard = this.createTokenButtons(tokenBalances, wallet);

        // Remove loading message
        if (loadingMsg) {
            await this.bot.deleteMessage(chatId, loadingMsg.message_id);
        }

        // Send wallet details message
        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });

        return true;
    } catch (error) {
        console.error('❌ Error showing wallet details:', error);

        // Show error message
        if (loadingMsg) {
            await this.bot.deleteMessage(chatId, loadingMsg.message_id);
        }

        await this.bot.sendMessage(chatId, '❌ Error loading wallet details. Please try again.', {
            reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: 'view_wallets' }]] },
        });

        return false;
    }
}

formatWalletDetails(wallet, tokenCount) {
  const networkDisplay = networkState.getNetworkDisplay(wallet.network);

  return `*Wallet Details* 👛\n\n` +
         `🔗 Network: ${networkDisplay}\n` +
         `🌍 Address: \`${wallet.address}\`\n` +
         `💎 Wallet Type: ${wallet.type === 'walletconnect' ? 'External 🔗' : 'Internal 👛'}\n` +
         `🤖 Autonomous: ${wallet.isAutonomous ? '✅ Enabled' : '❌ Disabled'}\n\n` +
         `✨ *Tokens Discovered*: ~ _${tokenCount}_`;
}

createTokenButtons(tokenBalances, wallet) {
  const tokenButtons = tokenBalances
      .filter(token => token.balance !== '0' || token.address === 'native')
      .map(token => [{
          text: `${token.symbol}: ${formatBalance(token.balance)}`,
          callback_data: `token_${token.address}_${wallet.network}`
      }]);

  return {
      inline_keyboard: [
          ...tokenButtons,
          [
              {
                  text: wallet.isAutonomous ? '🔴 Remove Autonomous' : '🟢 Set as Autonomous',
                  callback_data: `set_autonomous_${wallet.address}`
              },
              { text: '↩️ Back', callback_data: 'back_to_wallets' }
          ]
      ]
  };
}


  /**
   * Show menu for sending tokens
   */
  async showSendTokenMenu(chatId, network, tokenAddress) {
    const loadingMsg = await this.showLoadingMessage(chatId, '✍️ Preparing send token menu...');
console.log(chatId, ' and network: ', network, ' and tokenAddress: ', tokenAddress);
    try {
      // Fetch token details
      const token = await tokenService.getTokenInfo(network, tokenAddress);
      if (!token) {
        throw new Error('Token details not found.');
      }

      // Remove loading message
      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      // Send send token menu
      await this.bot.sendMessage(
        chatId,
        `*Send Token* 📤\n\n` +
          `You are about to send *${token.symbol}*.\n` +
          `Please enter the recipient's address and amount in the following format:\n` +
          `\`<address> space <amount>\`\n\n` +
          `Example:\n` +
          `\`0x123...456 0.12\``,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '↩️ Back', callback_data: `token_${token.address}_${network}` }]],
          },
        }
      );

      return true;
    } catch (error) {
      console.error('❌ Error showing send token menu:', error);

      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }

      await this.bot.sendMessage(chatId, '❌ Error preparing send token menu. Please try again.', {
        reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: `token_${token.address}_${network}` }]] },
      });

      return false;
    }
  }


//===============================================================================================================

  /**
   * Show all wallets for a user
   */
  async showWallets(chatId, userInfo) {
    const loadingMsg = await this.showLoadingMessage(chatId, '👛 Loading your wallets...');

    try {
      // Fetch all wallets
      const wallets = await walletService.getWallets(userInfo.id);
      if (!wallets.length) {
        throw new Error('No wallets found.');
      }

      // Construct inline keyboard with all wallets
      const keyboard = {
        inline_keyboard: wallets.map((wallet) => [
          { text: `${wallet.network.toUpperCase()} - ${wallet.address}`, callback_data: `wallet_${wallet.address}` },
        ]),
      };

      // Remove loading message
      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      // Send wallet list message
      await this.bot.sendMessage(
        chatId,
        '*Your Wallets* 👛\n\nSelect a wallet to view details:',
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );

      return true;
    } catch (error) {
      console.error('❌ Error showing wallets:', error);

      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }

      await this.bot.sendMessage(
        chatId,
        '❌ Error loading wallets. Please try again.',
        { reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: 'view_wallets' }]] } }
      );

      return false;
    }
  }

  /**
   * Set or remove autonomous wallet
   */
  async setAutonomousWallet(chatId, userInfo, address) {
    const loadingMsg = await this.showLoadingMessage(chatId, '⚙️ Updating wallet settings...');

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
                { text: '↩️ Back', callback_data: 'view_wallets' },
              ],
            ],
          },
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
                { text: '↩️ Back', callback_data: 'view_wallets' },
              ],
            ],
          },
        }
      );

      return false;
    }
  }
}
