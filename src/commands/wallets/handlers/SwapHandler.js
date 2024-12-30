import { User } from '../../../models/User.js';
import { swapService } from '../../../services/trading/SwapService.js';
import { ErrorHandler } from '../../../core/errors/index.js';
import { USER_STATES } from '../../../core/constants.js';

export class SwapHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async initiateSwap(chatId, userInfo, tokenData) {
    const loadingMsg = await this.bot.sendMessage(chatId, '🔍 Analyzing token...');

    try {
      const [tokenAddress, walletAddress] = tokenData.split('_');
      
      const { token, walletInfo, balance } = await swapService.getTokenDetails(
        userInfo, 
        tokenAddress, 
        walletAddress
      );

      // Store swap data
      await this.setUserData(userInfo.id, {
        swapToken: {
          tokenAddress,
          walletAddress,
          network: walletInfo.network,
          symbol: token.symbol,
          balance
        }
      });

      await this.setState(userInfo.id, USER_STATES.WAITING_SWAP_DIRECTION);

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📈 Buy', callback_data: `swap_buy_${tokenAddress}_${walletAddress}` },
            { text: '📉 Sell', callback_data: `swap_sell_${tokenAddress}_${walletAddress}` }
          ],
          [{ text: '❌ Cancel', callback_data: `token_${tokenAddress}_${walletAddress}` }]
        ]
      };

      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }

      await this.bot.sendMessage(
        chatId,
        `*${token.symbol} Swap* 💱\n\n` +
        `Available Balance: ${balance}\n\n` +
        `Choose your action:`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );

      return true;
    } catch (error) {
      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }
      await ErrorHandler.handle(error, this.bot, chatId);
      throw error;
    }
  }

  async handleSwapDirection(chatId, userInfo, action) {
    try {
      const [direction, tokenAddress, walletAddress] = action.split('_').slice(1);
      const userData = await this.getUserData(userInfo.id);
      
      if (!userData?.swapToken) {
        throw new Error('Swap data not found');
      }

      // Update swap data with direction
      userData.swapToken.direction = direction;
      await this.setUserData(userInfo.id, userData);

      // Ask for amount
      await this.setState(userInfo.id, USER_STATES.WAITING_SWAP_AMOUNT);

      await this.bot.sendMessage(
        chatId,
        `*${direction.toUpperCase()} ${userData.swapToken.symbol}* 💱\n\n` +
        `Available: ${userData.swapToken.balance}\n\n` +
        `Please enter the amount to ${direction}:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '❌ Cancel', callback_data: `token_${tokenAddress}_${walletAddress}` }
            ]]
          }
        }
      );

      return true;
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
      throw error;
    }
  }

  async handleSwapAmount(chatId, userInfo, amount) {
    try {
      const userData = await this.getUserData(userInfo.id);
      if (!userData?.swapToken) {
        throw new Error('Swap data not found');
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Invalid amount');
      }

      if (userData.swapToken.direction === 'sell' && numAmount > parseFloat(userData.swapToken.balance)) {
        throw new Error('Insufficient balance');
      }

      // Update swap data
      userData.swapToken.amount = amount;
      await this.setUserData(userInfo.id, userData);

      // Show confirmation
      await this.showSwapConfirmation(chatId, userData.swapToken);

      return true;
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
      throw error;
    }
  }

  async showSwapConfirmation(chatId, swapData) {
    const details = swapService.formatSwapDetails(
      swapData.symbol,
      swapData.balance,
      swapData.direction,
      swapData.amount
    );

    await this.bot.sendMessage(
      chatId,
      `*Confirm Swap* ✅\n\n` +
      `Action: ${details.direction.toUpperCase()}\n` +
      `Token: ${details.token}\n` +
      `Amount: ${details.amount}\n\n` +
      `Please confirm the swap:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Confirm', callback_data: 'confirm_swap' },
              { text: '❌ Cancel', callback_data: `token_${swapData.tokenAddress}_${swapData.walletAddress}` }
            ]
          ]
        }
      }
    );
  }

  async executeSwap(chatId, userInfo) {
    const loadingMsg = await this.bot.sendMessage(chatId, '💱 Processing swap...');

    try {
      const userData = await this.getUserData(userInfo.id);
      if (!userData?.swapToken) {
        throw new Error('Swap data not found');
      }

      const result = await swapService.executeSwap(userData.swapToken);

      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }

      await this.bot.sendMessage(
        chatId,
        `✅ *Swap Successful*\n\n` +
        `${userData.swapToken.direction.toUpperCase()} ${userData.swapToken.amount} ${userData.swapToken.symbol}\n` +
        `Price: $${result.price}\n` +
        `Hash: \`${result.hash}\``,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '↩️ Back', callback_data: `token_${userData.swapToken.tokenAddress}_${userData.swapToken.walletAddress}` }
            ]]
          }
        }
      );

      await this.clearState(userInfo.id);
      return true;
    } catch (error) {
      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }
      await ErrorHandler.handle(error, this.bot, chatId);
      throw error;
    }
  }
}