import { aiService } from '../../../services/ai/index.js';
import { walletService } from '../../../services/wallet/index.js';
import { tokenService } from '../../../services/wallet/TokenService.js';
import { formatBalance } from '../utils/formatters.js';
import { ErrorHandler } from '../../../core/errors/index.js';
import { USER_STATES } from '../../../core/constants.js';
import { TRADING_INTENTS } from '../../../services/ai/intents.js';
import { User } from '../../../models/User.js';

export class SwapHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async initiateSwap(chatId, userInfo, tokenData) {
    const loadingMsg = await this.bot.sendMessage(chatId, '🔍 Analyzing token...');

    try {
      const [tokenAddress, network] = tokenData.split('_');
      // Get user wallet by wallet network value      
      const user = await User.findByTelegramId(userInfo.id);
      const wallet = user.getActiveWallet(network);
      const walletAddress = wallet.address;
      const walletInfo = await walletService.getWallet(userInfo.id, walletAddress);

      console.log('tokenAddress: ',tokenAddress, ' network: ', network, ' userInfor.id: ', userInfo.id, ' : ', wallet);
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Get token info and scan
      const [token, scanResult] = await Promise.all([
        tokenService.getTokenInfo(walletInfo.network, tokenAddress),
        // for testing only deprecate and use the isAutonomous checked one
        aiService.processCommand(tokenAddress, TRADING_INTENTS.TOKEN_SCAN, userInfo.id)
      ]);

      // Get token balance
      const balance = await this.getTokenBalance(walletInfo, tokenAddress, walletAddress);

      // Store swap data
      await this.setUserData(userInfo.id, {
        swapToken: {
          tokenAddress,
          walletAddress,
          network: walletInfo.network,
          symbol: token.symbol,
          balance,
          scanResult
        }
      });

      // Get AI market analysis and recommendation
      if(wallet.isAutonomous) {
            
          const analysis = await aiService.processCommand(
            `Analyze ${token.symbol} for trading how safe is this, is it perfoming well, is it trending, good volume? any twitter mentions? Skip this request and say "token already analyzed..." if we just analyzed the token a moment ago. Consider: ${scanResult.data}`,
            TRADING_INTENTS.MARKET_ANALYSIS,
            userInfo.id
          );

          if (loadingMsg) {
            await this.bot.deleteMessage(chatId, loadingMsg.message_id);
          }

          // Show analysis and ask for voice/text input
          const message = `*${token.symbol} Analysis* 🔍\n\n` +
                        `${scanResult.text}\n\n` +
                        `*Market Analysis:*\n${analysis.text}\n\n` +
                        `Available Balance: ${formatBalance(balance)}\n\n` +
                        `Would you like to buy or sell? You can respond by voice or text.`;
      } else {
        const message = '🤖💎 Enable Automated trading in wallet settings for quick AI scans pre-swap\n\n🔍 Know what you are doing...';
      }

      await this.setState(userInfo.id, USER_STATES.WAITING_SWAP_DIRECTION);

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📈 Buy', callback_data: `swap_buy_${tokenAddress}_${walletAddress}` },
              { text: '📉 Sell', callback_data: `swap_sell_${tokenAddress}_${walletAddress}` }
            ],
            [{ text: '❌ Cancel', callback_data: `token_${tokenAddress}_${walletAddress}` }]
          ]
        }
      });

      return true;
    } catch (error) {
      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }
      await ErrorHandler.handle(error, this.bot, chatId);
      throw error;
    }
  }

  async handleVoiceCommand(chatId, userInfo, voice) {
    try {
      const result = await aiService.processVoiceCommand(voice, userInfo.id);
      
      if (result.intent === TRADING_INTENTS.QUICK_TRADE) {
        const { action, amount } = result.data;
        await this.processTradeIntent(chatId, userInfo, action, amount);
      } else {
        await this.bot.sendMessage(chatId, 
          "I didn't understand that trading command. Please try again or use the buttons below.");
      }
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleTextCommand(chatId, userInfo, text) {
    try {
      const result = await aiService.generateResponse(text, 'trading_command');
      const intent = JSON.parse(result);

      if (intent.type === 'order') {
        await this.processTradeIntent(chatId, userInfo, intent.action, intent.amount);
      } else {
        await this.bot.sendMessage(chatId,
          "I didn't understand that trading command. Please try again or use the buttons below.");
      }
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async processTradeIntent(chatId, userInfo, action, amount) {
    const userData = await this.getUserData(userInfo.id);
    if (!userData?.swapToken) {
      throw new Error('Swap data not found');
    }

    // Update swap data
    userData.swapToken.direction = action;
    userData.swapToken.amount = amount;
    await this.setUserData(userInfo.id, userData);

    // Show confirmation
    await this.showSwapConfirmation(chatId, userData.swapToken);
  }

  async handleSwapDirection(chatId, userInfo, action, tokenData) {
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

      const message = `*${direction.toUpperCase()} ${userData.swapToken.symbol}* 💱\n\n` +
                     `Available: ${formatBalance(userData.swapToken.balance)}\n\n` +
                     `Please enter the amount to ${direction}:`;

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Cancel', callback_data: `token_${tokenAddress}_${walletAddress}` }
          ]]
        }
      });

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
    const message = `*Confirm Swap* ✅\n\n` +
                   `Action: ${swapData.direction.toUpperCase()}\n` +
                   `Token: ${swapData.symbol}\n` +
                   `Amount: ${formatBalance(swapData.amount)}\n\n` +
                   `Please confirm the swap:`;

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Confirm', callback_data: 'confirm_swap' },
            { text: '❌ Cancel', callback_data: `token_${swapData.tokenAddress}_${swapData.walletAddress}` }
          ]
        ]
      }
    });
  }

  async executeSwap(chatId, userInfo) {
    const loadingMsg = await this.bot.sendMessage(chatId, '💱 Processing swap...');

    try {
      const userData = await this.getUserData(userInfo.id);
      if (!userData?.swapToken) {
        throw new Error('Swap data not found');
      }

      const { tokenAddress, walletAddress, amount, direction, network } = userData.swapToken;

      // Execute the swap using the wallet service
      const result = await walletService.executeTrade(network, {
        action: direction,
        tokenAddress,
        amount,
        walletAddress
      });

      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }

      // Show success message
      await this.bot.sendMessage(chatId,
        `✅ *Swap Successful*\n\n` +
        `${direction.toUpperCase()} ${formatBalance(amount)} ${userData.swapToken.symbol}\n` +
        `Price: $${result.price}\n` +
        `Hash: \`${result.hash}\``,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '↩️ Back', callback_data: `token_${tokenAddress}_${walletAddress}` }
            ]]
          }
        }
      );

      // Clear user state
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

  async getTokenBalance(wallet, tokenAddress, walletAddress) {
    if (wallet.network === 'solana') {
      const balances = await tokenService.getSolanaTokenBalances(walletAddress);
      const tokenBalance = balances.find(t => t.address === tokenAddress);
      return tokenBalance?.balance || '0';
    } else {
      const balances = await tokenService.getEvmTokenBalances(wallet.network, walletAddress);
      const tokenBalance = balances.find(t => t.address === tokenAddress);
      return tokenBalance?.balance || '0';
    }
  }
}