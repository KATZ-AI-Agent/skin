import { BaseCommand } from '../base/BaseCommand.js';
import { ErrorHandler } from '../../core/errors/index.js';
import { User } from '../../models/User.js';
import { networkState } from '../../services/networkState.js';
import { USER_STATES } from '../../core/constants.js';

export class SettingsCommand extends BaseCommand {
  constructor(bot) {
    super(bot);
    this.command = '/settings';
    this.description = 'Configure bot settings';
    this.pattern = /^(\/settings|⚙️ Settings)$/;

    // Map of callback handlers
    this.callbackHandlers = new Map([
      ['slippage_settings', this.showSlippageSettings.bind(this)],
      ['notification_settings', this.showNotificationSettings.bind(this)],
      ['toggle_notifications', this.toggleNotifications.bind(this)],
      ['switch_network', this.showSwitchNetwork.bind(this)],
      ['back_to_settings', this.showSettingsMenu.bind(this)],
      ['adjust_eth_slippage', (query) => this.showSlippageInput(query, 'ethereum')],
      ['adjust_base_slippage', (query) => this.showSlippageInput(query, 'base')],
      ['adjust_sol_slippage', (query) => this.showSlippageInput(query, 'solana')],
    ]);
  }

  /** Dispatcher for Callback Queries */
  async handleCallbackQuery(action, query) {
    const handler = this.callbackHandlers.get(action);
    if (handler) {
      try {
        await handler(query.message.chat.id, query.from, query);
      } catch (error) {
        console.error(`❌ Error handling "${action}":`, error.message);
        await ErrorHandler.handle(error, this.bot, query.message.chat.id);
      }
    } else {
      console.warn(`⚠️ No handler found for action: ${action}`);
    }
  }

  /** Main Entry Point for the Command */
  async execute(msg) {
    const chatId = msg.chat.id;
    try {
      await this.showSettingsMenu(chatId, msg.from);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  /** Show Settings Menu */
  async showSettingsMenu(chatId, userInfo) {
    try {
      const user = await User.findOne({ telegramId: userInfo.id.toString() }).lean();
      const currentNetwork = await networkState.getCurrentNetwork(userInfo.id);

      const keyboard = this.createKeyboard([
        [{ text: '🔄 Switch Network', callback_data: 'switch_network' }],
        [{ text: '⚙️ Slippage Settings', callback_data: 'slippage_settings' }],
        [{ text: '🤖 Autonomous Trading', callback_data: 'autonomous_settings' }],
        [{ text: '🔔 Notification Settings', callback_data: 'notification_settings' }],
        [{ text: '🫅 Butler Assistant', callback_data: 'butler_assistant' }],
        [{ text: '↩️ Back to Menu', callback_data: 'back_to_wallets' }],
      ]);

      await this.bot.sendMessage(
        chatId,
        `*Settings* ⚙️\n\n` +
          `Current Network: *${networkState.getNetworkDisplay(currentNetwork)}*\n` +
          `Slippage: ${user?.settings?.trading?.slippage?.[currentNetwork]}%\n` +
          `Autonomous Trading: ${user?.settings?.trading?.autonomousEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
          `Notifications: ${user?.settings?.notifications?.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
          `Butler: ${user?.settings?.butler?.enabled ? '✅ Enabled' : '❌ Disabled'}\n\n` +
          'Configure your preferences:',
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  /** Slippage Settings */
  async showSlippageSettings(chatId, userInfo) {
    try {
      const user = await User.findOne({ telegramId: userInfo.id.toString() }).lean();
      const slippage = user?.settings?.trading?.slippage || { ethereum: 3, base: 3, solana: 3 };

      const keyboard = this.createKeyboard([
        [{ text: `ETH (${slippage.ethereum}%)`, callback_data: 'adjust_eth_slippage' }],
        [{ text: `Base (${slippage.base}%)`, callback_data: 'adjust_base_slippage' }],
        [{ text: `Solana (${slippage.solana}%)`, callback_data: 'adjust_sol_slippage' }],
        [{ text: '↩️ Back', callback_data: 'back_to_settings' }],
      ]);

      await this.bot.sendMessage(
        chatId,
        '*Slippage Settings* ⚙️\n\nAdjust slippage tolerance for trading.',
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  /** Show Slippage Input */
  async showSlippageInput(query, network) {
    const chatId = query.message.chat.id;
    const userInfo = query.from;
    try {
      await this.setState(userInfo.id, USER_STATES.WAITING_SLIPPAGE_INPUT);
      await this.setUserData(userInfo.id, { pendingSlippage: { network } });

      await this.bot.sendMessage(
        chatId,
        `*Enter New Slippage for ${network.toUpperCase()}* ⚙️\n\nEnter a number between 0.1 and 50.`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'slippage_settings' }]] } }
      );
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  /** Autonomous Trading Settings */
  async showAutonomousSettings(chatId, userInfo) {
    try {
      const user = await User.findOne({ telegramId: userInfo.id.toString() }).lean();
      const isEnabled = user?.settings?.trading?.autonomousEnabled;

      const keyboard = this.createKeyboard([
        [{ text: isEnabled ? '🔴 Disable Autonomous Trading' : '🟢 Enable Autonomous Trading', callback_data: 'toggle_autonomous' }],
        [{ text: '↩️ Back', callback_data: 'back_to_wallets' }],
      ]);

      await this.bot.sendMessage(
        chatId,
        `*Autonomous Trading Settings* 🤖\n\nCurrent Status: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  /** Toggle Autonomous Trading */
  async toggleAutonomousTrading(chatId, userInfo) {
    try {
      const user = await User.findOne({ telegramId: userInfo.id.toString() }).lean();
      const newState = !user?.settings?.trading?.autonomousEnabled;

      await User.updateOne(
        { telegramId: userInfo.id.toString() },
        { $set: { 'settings.trading.autonomousEnabled': newState } }
      );

      await this.bot.sendMessage(
        chatId,
        `✅ Autonomous Trading ${newState ? 'enabled' : 'disabled'} successfully.`,
        { reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: 'autonomous_settings' }]] } }
      );
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  /** Notification Settings */
  async showNotificationSettings(chatId, userInfo) {
    try {
      const user = await User.findOne({ telegramId: userInfo.id.toString() }).lean();
      const notificationsEnabled = user?.settings?.notifications?.enabled || false;

      const keyboard = this.createKeyboard([
        [{ text: notificationsEnabled ? '🔕 Disable Notifications' : '🔔 Enable Notifications', callback_data: 'toggle_notifications' }],
        [{ text: '↩️ Back', callback_data: 'back_to_settings' }],
      ]);

      await this.bot.sendMessage(
        chatId,
        `*Notification Settings* 🔔\n\nCurrent Status: ${notificationsEnabled ? '✅ Enabled' : '❌ Disabled'}`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  /** Toggle Notifications */
  async toggleNotifications(chatId, userInfo) {
    try {
      const user = await User.findOne({ telegramId: userInfo.id.toString() }).lean();
      const newState = !user?.settings?.notifications?.enabled;

      await User.updateOne(
        { telegramId: userInfo.id.toString() },
        { $set: { 'settings.notifications.enabled': newState } }
      );

      await this.bot.sendMessage(
        chatId,
        `✅ Notifications have been *${newState ? 'enabled' : 'disabled'}*.`,
        { reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: 'notification_settings' }]] } }
      );
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  /** Toggle Butler Assistant */
  async toggleButlerAssistant(chatId, userInfo) {
    try {
      const user = await User.findOne({ telegramId: userInfo.id.toString() }).lean();
      const newState = !user?.settings?.butler?.enabled;

      await User.updateOne(
        { telegramId: userInfo.id.toString() },
        { $set: { 'settings.butler.enabled': newState } }
      );

      await this.bot.sendMessage(
        chatId,
        `✅ Butler Assistant has been *${newState ? 'enabled' : 'disabled'}*.`,
        { reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: 'back_to_settings' }]] } }
      );
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  /** Switch Network */
  async showSwitchNetwork(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: 'Ethereum', callback_data: 'switch_network_ethereum' }],
      [{ text: 'Base', callback_data: 'switch_network_base' }],
      [{ text: 'Solana', callback_data: 'switch_network_solana' }],
      [{ text: '↩️ Back', callback_data: 'back_to_settings' }],
    ]);

    await this.bot.sendMessage(chatId, '*Switch Network* 🔄\n\nChoose your preferred network.', {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }
}
