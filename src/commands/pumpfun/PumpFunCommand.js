import { Command } from '../base/Command.js';
import { flipperMode } from '../../services/pumpfun/FlipperMode.js';
import { walletService } from '../../services/wallet/index.js';
import { aiService } from '../../services/ai/index.js';
import { USER_STATES } from '../../core/constants.js';
import { circuitBreakers } from '../../core/circuit-breaker/index.js';
import { BREAKER_CONFIGS } from '../../core/circuit-breaker/index.js';
import { ErrorHandler } from '../../core/errors/index.js';
import { timedOrderService } from '../../services/timedOrders.js';

export class PumpFunCommand extends Command {
  constructor(bot, eventHandler) {
    super(bot, eventHandler);
    this.command = '/pump';
    this.description = 'Trade on Pump.fun';
    this.pattern = /^(\/pump|💊 Pump\.fun)$/;

    // Register event handlers for FlipperMode
    this.setupFlipperModeHandlers();
  }

  setupFlipperModeHandlers() {
    flipperMode.on('entryExecuted', async ({ token, result }) => {
      await circuitBreakers.executeWithBreaker(
        'pumpFun',
        async () => {
          const response = await aiService.generateResponse(
            `New position opened in ${token.symbol} at $${result.price}`,
            'trading'
          );
          await this.bot.sendMessage(
            this.userId,
            `*New FlipperMode Entry* 📈\n\n` +
              `Token: ${token.symbol}\n` +
              `Price: $${result.price}\n\n` +
              `*AI Analysis:*\n${response}`,
            { parse_mode: 'Markdown' }
          );
        },
        BREAKER_CONFIGS.pumpFun
      ).catch(error => ErrorHandler.handle(error));
    });

    flipperMode.on('exitExecuted', async ({ token, reason, result }) => {
      await circuitBreakers.executeWithBreaker(
        'pumpFun',
        async () => {
          const response = await aiService.generateResponse(
            `Position closed in ${token.symbol} at $${result.price} due to ${reason}`,
            'trading'
          );
          await this.bot.sendMessage(
            this.userId,
            `*FlipperMode Exit* 📉\n\n` +
              `Token: ${token.symbol}\n` +
              `Price: $${result.price}\n` +
              `Reason: ${reason}\n\n` +
              `*AI Analysis:*\n${response}`,
            { parse_mode: 'Markdown' }
          );
        },
        BREAKER_CONFIGS.pumpFun
      ).catch(error => ErrorHandler.handle(error));
    });
  }

  async execute(msg) {
    const chatId = msg.chat.id;
    try {
      await this.handlePumpFunCommand(chatId, msg.from);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handlePumpFunCommand(chatId, userInfo) {
    await circuitBreakers.executeWithBreaker(
      'pumpFun',
      async () => {
        const activeWallet = await walletService.getActiveWallet(userInfo.id);
        if (!activeWallet) {
          await this.showWalletRequiredMessage(chatId);
          return;
        }

        const loadingMsg = await this.showLoadingMessage(chatId, '😼 Loading PumpFun data...');
        try {
          const positions = flipperMode.getOpenPositions();
          await this.deleteMessage(chatId, loadingMsg.message_id);

          const keyboard = this.createKeyboard([
            [{ text: '👀 Watch New Tokens', callback_data: 'pump_watch' }],
            [{ text: '💰 Buy Token', callback_data: 'pump_buy' }],
            [{ text: '💱 Sell Token', callback_data: 'pump_sell' }],
            [{ text: '🤖 FlipperMode', callback_data: 'flipper_mode' }],
            [{ text: '📊 View Positions', callback_data: 'view_positions' }],
            [{ text: '↩️ Back to Menu', callback_data: '/start' }]
          ]);

          let message = '*PumpFun Trading* 💊\n\n';
          if (positions.length > 0) {
            message += '*Active Positions:*\n';
            positions.forEach((pos, index) => {
              message += `${index + 1}. ${pos.token.symbol} - $${pos.currentPrice}\n`;
            });
            message += '\n';
          }

          message += 'Select an action:\n\n' +
            '• Watch new token listings\n' +
            '• Buy tokens with SOL\n' +
            '• Sell tokens for SOL\n' +
            '• Enable FlipperMode\n' +
            '• Manage positions\n\n' +
            '_Note: All trades have 3% default slippage_';

          await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
        } catch (error) {
          if (loadingMsg) {
            await this.deleteMessage(chatId, loadingMsg.message_id);
          }
          throw error;
        }
      },
      BREAKER_CONFIGS.pumpFun
    ).catch(error => ErrorHandler.handle(error, this.bot, chatId));
  }

  async handleCallback(query) {
    const chatId = query.message.chat.id;
    const action = query.data;
    const userInfo = query.from;

    try {
      switch (action) {
        case 'pump_watch':
          await this.startTokenWatching(chatId);
          break;

        case 'pump_buy':
          await this.showBuyForm(chatId);
          break;

        case 'pump_sell':
          await this.showSellForm(chatId);
          break;

        case 'flipper_mode':
          await this.startFlipperMode(chatId, userInfo);
          break;

        case 'stop_flipper':
          await this.stopFlipperMode(chatId);
          break;

        case 'view_positions':
          await this.showOpenPositions(chatId);
          break;

        case 'pump_retry':
          await this.handlePumpFunCommand(chatId);
          break;

        default:
          if (action.startsWith('close_position_')) {
            const tokenAddress = action.replace('close_position_', '');
            await this.closePosition(chatId, tokenAddress);
          } else if (action.startsWith('adjust_tp_')) {
            const tokenAddress = action.replace('adjust_tp_', '');
            await this.adjustTakeProfit(chatId, tokenAddress);
          } else if (action.startsWith('adjust_sl_')) {
            const tokenAddress = action.replace('adjust_sl_', '');
            await this.adjustStopLoss(chatId, tokenAddress);
          }
      }
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async adjustTakeProfit(chatId, tokenAddress) {
    await this.bot.sendMessage(chatId, '*Adjust Take Profit* 📈\n\nEnter the new TP percentage:', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '❌ Cancel', callback_data: `position_details_${tokenAddress}` }]]
      }
    });

    this.setState(chatId, USER_STATES.WAITING_TP_INPUT);
    this.setUserData(chatId, { pendingTP: { tokenAddress } });
  }

  async adjustStopLoss(chatId, tokenAddress) {
    await this.bot.sendMessage(chatId, '*Adjust Stop Loss* 📉\n\nEnter the new SL percentage:', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '❌ Cancel', callback_data: `position_details_${tokenAddress}` }]]
      }
    });

    this.setState(chatId, USER_STATES.WAITING_SL_INPUT);
    this.setUserData(chatId, { pendingSL: { tokenAddress } });
  }

  async handleInput(msg) {
    const state = await this.getState(msg.chat.id);
    const chatId = msg.chat.id;

    if (state === USER_STATES.WAITING_TP_INPUT) {
      await this.updateTakeProfit(chatId, msg.text);
    } else if (state === USER_STATES.WAITING_SL_INPUT) {
      await this.updateStopLoss(chatId, msg.text);
    }
  }

  async updateTakeProfit(chatId, percentage) {
    const userData = await this.getUserData(chatId);
    const tokenAddress = userData.pendingTP.tokenAddress;

    if (isNaN(percentage) || percentage <= 0) {
      await this.bot.sendMessage(chatId, '❌ Invalid percentage entered. Please try again.');
      return;
    }

    await timedOrderService.createOrder(chatId, {
      tokenAddress,
      action: 'sell',
      amount: flipperMode.getOpenPositions().find(pos => pos.token.address === tokenAddress).amount,
      executeAt: new Date(Date.now() + 1000), // Execute immediately
      conditions: { profitTarget: percentage }
    });

    await this.bot.sendMessage(chatId, `✅ Take Profit set at ${percentage}% successfully!`);
    await this.clearState(chatId);
  }

  async updateStopLoss(chatId, percentage) {
    const userData = await this.getUserData(chatId);
    const tokenAddress = userData.pendingSL.tokenAddress;

    if (isNaN(percentage) || percentage <= 0) {
      await this.bot.sendMessage(chatId, '❌ Invalid percentage entered. Please try again.');
      return;
    }

    await timedOrderService.createOrder(chatId, {
      tokenAddress,
      action: 'sell',
      amount: flipperMode.getOpenPositions().find(pos => pos.token.address === tokenAddress).amount,
      executeAt: new Date(Date.now() + 1000), // Execute immediately
      conditions: { stopLoss: percentage }
    });

    await this.bot.sendMessage(chatId, `✅ Stop Loss set at ${percentage}% successfully!`);
    await this.clearState(chatId);
  }











  async closePosition(chatId, tokenAddress) {
    await circuitBreakers.executeWithBreaker(
      'pumpFun',
      async () => {
        const loadingMsg = await this.showLoadingMessage(chatId, '🔄 Closing position...');
        try {
          const result = await flipperMode.closePosition(tokenAddress);
          
          await this.deleteMessage(chatId, loadingMsg.message_id);
          await this.bot.sendMessage(
            chatId,
            '*Position Closed* ✅\n\n' +
            `Token: ${result.token.symbol}\n` +
            `Exit Price: $${result.price}\n` +
            `P/L: ${result.profitLoss}%`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[
                  { text: '📊 View Positions', callback_data: 'view_positions' },
                  { text: '↩️ Back', callback_data: 'back_to_pump' }
                ]]
              }
            }
          );
        } catch (error) {
          if (loadingMsg) {
            await this.deleteMessage(chatId, loadingMsg.message_id);
          }
          throw error;
        }
      },
      BREAKER_CONFIGS.pumpFun
    ).catch(error => this.showErrorMessage(chatId, error, 'retry_close'));
  }

  async showOpenPositions(chatId) {
    const positions = flipperMode.getOpenPositions();
    
    if (positions.length === 0) {
      await this.bot.sendMessage(
        chatId,
        '*No Open Positions* 📊\n\n' +
        'Start trading or enable FlipperMode to open positions.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '🤖 FlipperMode', callback_data: 'flipper_mode' },
              { text: '↩️ Back', callback_data: 'back_to_pump' }
            ]]
          }
        }
      );
      return;
    }

    const keyboard = {
      inline_keyboard: positions.map(pos => ([
        { 
          text: `${pos.token.symbol} ($${pos.currentPrice})`,
          callback_data: `position_details_${pos.token.address}`
        }
      ])).concat([[
        { text: '↩️ Back', callback_data: 'back_to_pump' }
      ]])
    };

    await this.bot.sendMessage(
      chatId,
      '*Open Positions* 📊\n\n' +
      positions.map((pos, i) => 
        `${i+1}. ${pos.token.symbol}\n` +
        `• Entry: $${pos.entryPrice}\n` +
        `• Current: $${pos.currentPrice}\n` +
        `• P/L: ${pos.profitLoss}%\n` +
        `• Time: ${pos.timeElapsed} mins`
      ).join('\n\n'),
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  }

  async showPositionDetails(chatId, tokenAddress) {
    const position = flipperMode.getPosition(tokenAddress);
    if (!position) {
      await this.bot.sendMessage(
        chatId,
        '❌ Position not found.',
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '↩️ Back', callback_data: 'view_positions' }
            ]]
          }
        }
      );
      return;
    }

    const keyboard = this.createKeyboard([
      [
        { text: '📈 Adjust TP', callback_data: `adjust_tp_${tokenAddress}` },
        { text: '📉 Adjust SL', callback_data: `adjust_sl_${tokenAddress}` }
      ],
      [{ text: '🔄 Close Position', callback_data: `close_position_${tokenAddress}` }],
      [{ text: '↩️ Back', callback_data: 'view_positions' }]
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Position Details* 📊\n\n' +
      `Token: ${position.token.symbol}\n` +
      `Entry Price: $${position.entryPrice}\n` +
      `Current Price: $${position.currentPrice}\n` +
      `Take Profit: $${position.takeProfit}\n` +
      `Stop Loss: $${position.stopLoss}\n` +
      `P/L: ${position.profitLoss}%\n` +
      `Time in Trade: ${position.timeElapsed} mins`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  }

  async showTakeProfitForm(chatId, tokenAddress) {
    await this.setState(chatId, 'WAITING_TP_INPUT');
    await this.setUserData(chatId, { pendingTP: { tokenAddress } });

    await this.bot.sendMessage(
      chatId,
      '*Adjust Take Profit* 📈\n\n' +
      'Enter new take profit percentage:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Cancel', callback_data: `position_details_${tokenAddress}` }
          ]]
        }
      }
    );
  }

  async showStopLossForm(chatId, tokenAddress) {
    await this.setState(chatId, 'WAITING_SL_INPUT');
    await this.setUserData(chatId, { pendingSL: { tokenAddress } });

    await this.bot.sendMessage(
      chatId,
      '*Adjust Stop Loss* 📉\n\n' +
      'Enter new stop loss percentage:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Cancel', callback_data: `position_details_${tokenAddress}` }
          ]]
        }
      }
    );
  }

  async startTokenWatching(chatId) {
    await this.setState(chatId, USER_STATES.WATCHING_PUMP_TOKENS);
    const msg = await this.bot.sendMessage(chatId, '👀 Watching for new tokens...');
    
    const callback = async (token) => {
      try {
        await this.simulateTyping(chatId);
        await this.bot.sendMessage(
          chatId,
          `🆕 *New Token Listed*\n\n` +
          `Symbol: ${token.symbol}\n` +
          `Price: ${token.price}\n` +
          `Time: ${new Date().toLocaleTimeString()}`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Error in token callback:', error);
      }
    };  
    
    pumpFunService.subscribe('newToken', callback);
    
    // Cleanup subscription after 5 minutes
    setTimeout(async () => {
      pumpFunService.unsubscribe('newToken', callback);
      await this.bot.deleteMessage(chatId, msg.message_id);
      await this.bot.sendMessage(chatId, 'Token watching session ended.');
      await this.clearState(chatId);
    }, 5 * 60 * 1000);
  }

  async showBuyForm(chatId) {
    await this.bot.sendMessage(
      chatId,
      '*Buy Token* 💰\n\n' +
      'Enter the token address and amount to buy:\n\n' +
      'Format: `<token_address> <amount_in_sol>`',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Cancel', callback_data: 'back_to_pump' }
          ]]
        }
      }
    );
  }

  async showSellForm(chatId) {
    await this.bot.sendMessage(
      chatId,
      '*Sell Token* 💱\n\n' +
      'Enter the token address and amount to sell:\n\n' +
      'Format: `<token_address> <amount_in_tokens>`',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Cancel', callback_data: 'back_to_pump' }
          ]]
        }
      }
    );
  }

  async showWalletRequiredMessage(chatId) {
    await this.bot.sendMessage(
      chatId,
      '❌ Please select or create a Solana wallet first.',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '👛 Go to Wallets', callback_data: '/wallets' }],
            [{ text: '↩️ Back to Menu', callback_data: '/start' }]
          ]
        }
      }
    );
  }
}
