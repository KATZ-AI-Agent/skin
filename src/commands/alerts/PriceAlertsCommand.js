import { BaseCommand } from '../base/BaseCommand.js';
import { AlertHandler } from './handlers/AlertHandler.js';
import { USER_STATES } from '../../core/constants.js';
import { ErrorHandler } from '../../core/errors/index.js';
import { networkState } from '../../services/networkState.js';

export class PriceAlertsCommand extends BaseCommand {
  constructor(bot, eventHandler) {
    super(bot);
    this.command = '/pricealerts';
    this.description = 'Set price alerts';
    this.pattern = /^(\/pricealerts|💰 Price Alerts)$/;

    this.alertHandler = new AlertHandler(bot);
    this.eventHandler = eventHandler;

    this.registerCallbacks();
  }

  registerCallbacks() {
    this.eventHandler.on('create_price_alert', async (query) => this.handleCreatePriceAlert(query));
    this.eventHandler.on('enable_swap', async (query) => this.handleEnableSwap(query));
    this.eventHandler.on('skip_swap', async (query) => this.handleSkipSwap(query));
    this.eventHandler.on('confirm_alert', async (query) => this.handleConfirmAlert(query));
    this.eventHandler.on('back_to_price_alerts', async (query) => this.handleBackToPriceAlerts(query));
  }

  async execute(msg) {
    const chatId = msg.chat.id;
    try {
      await this.showPriceAlertsMenu(chatId, msg.from);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async showPriceAlertsMenu(chatId, userInfo) {
    const keyboard = this.createKeyboard([
      [{ text: '➕ Create Alert', callback_data: 'create_price_alert' }],
      [{ text: '📋 View Alerts', callback_data: 'view_price_alerts' }],
      [{ text: '↩️ Back', callback_data: 'back_to_notifications' }],
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Price Alerts* 🔔\n\n' +
        'Create and manage price alerts:\n\n' +
        '• Set target prices\n' +
        '• Enable auto-swaps\n' +
        '• Multi-token monitoring\n' +
        '• Real-time notifications',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }

  async handleCallback(query) {
    const action = query.data;

    try {
      const handled = this.eventHandler.emit(action, query);
      if (!handled) {
        console.warn(`Unhandled callback action: ${action}`);
      }
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, query.message.chat.id);
    }
  }

  async handleCreatePriceAlert(query) {
    const chatId = query.message.chat.id;
    const userInfo = query.from;

    try {
      await this.setState(userInfo.id, USER_STATES.WAITING_PRICE_ALERT);
      await this.bot.sendMessage(
        chatId,
        '*Create Price Alert* 🎯\n\n' +
          'Please enter in this format:\n' +
          '`<token_address> <target_price> [above|below]`\n\n' +
          'Example: `0x123...abc 0.5 above`',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'back_to_price_alerts' }]],
          },
        }
      );
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleEnableSwap(query) {
    const chatId = query.message.chat.id;
    const userInfo = query.from;

    try {
      const userData = await this.getUserData(userInfo.id);
      await this.alertHandler.handleEnableSwap(
        chatId,
        userInfo,
        userData.pendingAlert.tokenAddress,
        userData.pendingAlert.walletAddress,
        userData.pendingAlert.amount
      );
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleSkipSwap(query) {
    const chatId = query.message.chat.id;
    const userInfo = query.from;

    try {
      await this.showAlertConfirmation(chatId, userInfo);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleConfirmAlert(query) {
    const chatId = query.message.chat.id;
    const userInfo = query.from;

    try {
      const alertData = await this.getUserData(userInfo.id);
      await this.alertHandler.savePriceAlert(chatId, userInfo, alertData.pendingAlert);
      await this.clearState(userInfo.id);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleBackToPriceAlerts(query) {
    const chatId = query.message.chat.id;

    try {
      await this.showPriceAlertsMenu(chatId, query.from);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleInput(msg) {
    const chatId = msg.chat.id;
    const state = await this.getState(msg.from.id);

    if (state === USER_STATES.WAITING_PRICE_ALERT && msg.text) {
      try {
        const pendingAlert = await this.alertHandler.handlePriceInput(chatId, msg.text, msg.from);
        await this.setUserData(msg.from.id, { pendingAlert });
        await this.showAlertConfirmation(chatId, msg.from);
        return true;
      } catch (error) {
        await ErrorHandler.handle(error, this.bot, chatId);
      }
    }
    return false;
  }

  async showAlertConfirmation(chatId, userInfo) {
    const userData = await this.getUserData(userInfo.id);
    const { pendingAlert } = userData;

    const keyboard = this.createKeyboard([
      [
        { text: '✅ Confirm', callback_data: 'confirm_alert' },
        { text: '❌ Cancel', callback_data: 'back_to_price_alerts' },
      ],
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Confirm Price Alert* ✅\n\n' +
        `Token: ${pendingAlert.tokenInfo.symbol}\n` +
        `Target Price: $${pendingAlert.targetPrice}\n` +
        `Condition: ${pendingAlert.condition}\n` +
        `Network: ${networkState.getNetworkDisplay(pendingAlert.network)}`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }
}
