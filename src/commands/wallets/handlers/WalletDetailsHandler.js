import { walletService } from '../../../services/wallet/index.js';
import { networkState } from '../../../services/networkState.js';

export class WalletDetailsHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async showLoadingMessage(chatId, message) {
    return this.bot.sendMessage(chatId, message);
  }

  /**
   * Show wallet details, including tokens
   */
  async showWalletDetails(chatId, userInfo, address) {
    const loadingMsg = await this.showLoadingMessage(chatId, '👛 Loading wallet details...');

    try {
      // Fetch wallet details
      const wallet = (await walletService.getWallets(userInfo.id)).find((w) => w.address === address);
      if (!wallet) {
        throw new Error('Wallet not found.');
      }

      // Fetch provider
      const provider = await walletService.getProvider(wallet.network);
      if (!provider) {
        throw new Error(`No provider found for network: ${wallet.network}`);
      }

      // Fetch native balance
      let nativeBalance;
      try {
        nativeBalance = await provider.getBalance(address);
      } catch (error) {
        console.error('Error fetching native balance:', error);
        nativeBalance = 'Error fetching balance';
      }

      // Fetch token balances
      let tokenBalances = [];
      try {
        if (provider.getTokenList && provider.getTokenBalance) {
          const tokens = await provider.getTokenList();
          tokenBalances = await Promise.all(
            tokens.map(async (token) => {
              try {
                const balance = await provider.getTokenBalance(address, token.address);
                return { symbol: token.symbol, balance, address: token.address };
              } catch (error) {
                console.warn(`Error fetching balance for token ${token.symbol}:`, error.message);
                return { symbol: token.symbol, balance: 'Error', address: token.address };
              }
            })
          );
        }
      } catch (error) {
        console.error('Error fetching token balances:', error);
        tokenBalances = [{ symbol: 'N/A', balance: 'Error fetching tokens', address: 'N/A' }];
      }

      // Remove loading message
      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      // Format token balances for display
      const tokenBalancesText =
        tokenBalances.map(({ symbol, balance }) => `${symbol}: ${balance} ${wallet.network === 'solana' ? 'SOL' : 'ETH'}`).join('\n') || 'No tokens found.';

      // Construct inline keyboard for tokens
      const tokenButtons = tokenBalances.map(({ symbol, address }) => [
        { text: `View ${symbol}`, callback_data: `token_${address}` },
      ]);

      // Add main wallet options
      const keyboard = {
        inline_keyboard: [
          ...tokenButtons,
          [
            {
              text: wallet.isAutonomous ? '🔴 Remove Autonomous' : '🟢 Set as Autonomous',
              callback_data: `set_autonomous_${address}`,
            },
          ],
          [{ text: '↩️ Back', callback_data: 'back_to_wallets' }],
        ],
      };

      // Send wallet details message
      await this.bot.sendMessage(
        chatId,
        `*Wallet Details* 👛\n\n` +
          `Network: ${networkState.getNetworkDisplay(wallet.network)}\n` +
          `Address: \`${address}\`\n` +
          `Balance: ${nativeBalance} ${wallet.network === 'solana' ? 'SOL' : 'ETH'}\n\n` +
          `*Token Balances:*\n${tokenBalancesText}\n\n` +
          `Type: ${wallet.type === 'walletconnect' ? 'External 🔗' : 'Internal 👛'}\n` +
          `Autonomous: ${wallet.isAutonomous ? '✅' : '❌'}`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );

      return true;
    } catch (error) {
      console.error('❌ Error showing wallet details:', error);

      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }

      await this.bot.sendMessage(chatId, '❌ Error loading wallet details. Please try again.', {
        reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: 'view_wallets' }]] },
      });

      return false;
    }
  }

  /**
   * Show token details for a specific token
   */
  async showTokenDetails(chatId, userInfo, tokenAddress) {
    const loadingMsg = await this.showLoadingMessage(chatId, '🔍 Loading token details...');

    try {
      // Fetch token details
      const token = await walletService.getTokenDetails(tokenAddress);
      if (!token) {
        throw new Error('Token details not found.');
      }

      // Remove loading message
      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      // Construct inline keyboard
      const keyboard = {
        inline_keyboard: [
          [{ text: '📤 Send Token', callback_data: `send_${tokenAddress}` }],
          [{ text: '↩️ Back', callback_data: `back_to_wallet_${token.walletAddress}` }],
        ],
      };

      // Send token details
      await this.bot.sendMessage(
        chatId,
        `*Token Details* 🪙\n\n` +
          `Symbol: ${token.symbol}\n` +
          `Balance: ${token.balance}\n` +
          `Address: \`${tokenAddress}\``,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );

      return true;
    } catch (error) {
      console.error('❌ Error showing token details:', error);

      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }

      await this.bot.sendMessage(chatId, '❌ Error loading token details. Please try again.', {
        reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: `back_to_wallet_${token.walletAddress}` }]] },
      });

      return false;
    }
  }

  /**
   * Show menu for sending tokens
   */
  async showSendTokenMenu(chatId, userInfo, tokenAddress) {
    const loadingMsg = await this.showLoadingMessage(chatId, '✍️ Preparing send token menu...');

    try {
      // Fetch token details
      const token = await walletService.getTokenDetails(tokenAddress);
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
          `\`<address> <amount>\`\n\n` +
          `Example:\n` +
          `\`0x123...456 10\``,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '↩️ Back', callback_data: `back_to_wallet_${token.walletAddress}` }]],
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
        reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: `back_to_wallet_${token.walletAddress}` }]] },
      });

      return false;
    }
  }


//===============================================================================================================

  async showSendTokenMenu(chatId, userInfo, tokenAddress) {
    const token = await walletService.getTokenDetails(userInfo.id, tokenAddress);
    const keyboard = {
      inline_keyboard: [[{ text: '↩️ Back', callback_data: `back_to_wallet_${token.walletAddress}` }]],
    };

    await this.bot.sendMessage(
      chatId,
      `*Send Token*\n\n` +
        `Symbol: ${token.symbol}\n` +
        `Balance: ${token.balance}\n\n` +
        'Please provide the recipient address and amount in the format:\n' +
        '`/send <recipient_address> <amount>`',
      { reply_markup: keyboard, parse_mode: 'Markdown' }
    );
  }

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
