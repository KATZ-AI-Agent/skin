import { ErrorHandler } from '../../../core/errors/index.js';
import { User } from '../../../models/User.js';
import { networkState } from '../../../services/networkState.js';
import { USER_STATES } from '../../../core/constants.js';

export class WalletSettingsHandler {
  constructor(bot) {
    this.bot = bot;
  }

  /** Show Wallet Settings Menu */
  async showWalletSettings(chatId, userInfo) {
    try {
      const user = await User.findOne({ telegramId: userInfo.id.toString() }).lean();
      const isAutonomousEnabled = user?.settings?.trading?.autonomousEnabled || false;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: `${isAutonomousEnabled ? '🔴 Disable' : '🟢 Enable'} Autonomous Trading`,
              callback_data: 'toggle_autonomous',
            },
          ],
          [{ text: '⚙️ Adjust Slippage', callback_data: 'slippage_settings' }],
          [{ text: '🔔 Notification Settings', callback_data: 'notification_settings' }],
          [{ text: '🫅 Butler Assistant', callback_data: 'butler_assistant' }],
          [{ text: '↩️ Back', callback_data: 'back_to_wallets' }],
        ],
      };

      await this.bot.sendMessage(
        chatId,
        `*Wallet Settings* ⚙️\n\nAutonomous Trading: ${
          isAutonomousEnabled ? '✅ Enabled' : '❌ Disabled'
        }\n\nConfigure your wallet settings:`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
      return true;
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
      return false;
    }
  }

  /** Show Slippage Settings */
  async showSlippageSettings(chatId, userInfo) {
    try {
      const user = await User.findOne({ telegramId: userInfo.id.toString() }).lean();
      const slippage = user?.settings?.trading?.slippage || { ethereum: 3, base: 3, solana: 3 };

      const keyboard = {
        inline_keyboard: [
          [{ text: `ETH (${slippage.ethereum}%)`, callback_data: 'adjust_eth_slippage' }],
          [{ text: `Base (${slippage.base}%)`, callback_data: 'adjust_base_slippage' }],
          [{ text: `Solana (${slippage.solana}%)`, callback_data: 'adjust_sol_slippage' }],
          [{ text: '↩️ Back', callback_data: 'wallet_settings' }],
        ],
      };

      await this.bot.sendMessage(
        chatId,
        `*Slippage Settings* ⚙️\n\nCurrent slippage tolerance:\n` +
          `• Ethereum: ${slippage.ethereum}%\n` +
          `• Base: ${slippage.base}%\n` +
          `• Solana: ${slippage.solana}%\n\nSelect a network to adjust:`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
      return true;
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
      return false;
    }
  }

  /** Show Slippage Input */
  async showSlippageInput(chatId, network, userInfo) {
    try {
      await this.setState(userInfo.id, USER_STATES.WAITING_SLIPPAGE_INPUT);
      await this.setUserData(userInfo.id, { pendingSlippage: { network } });

      await this.bot.sendMessage(
        chatId,
        `*Adjust Slippage for ${network.toUpperCase()}* ⚙️\n\nEnter a value between 0.1 and 50:`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'slippage_settings' }]] },
        }
      );
      return true;
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
      return false;
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
        `✅ Autonomous trading has been *${newState ? 'enabled' : 'disabled'}*.`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: 'wallet_settings' }]] },
        }
      );
      return true;
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
      return false;
    }
  }

  /** Show Notification Settings */
  async showNotificationSettings(chatId, userInfo) {
    try {
      const user = await User.findOne({ telegramId: userInfo.id.toString() }).lean();
      const notificationsEnabled = user?.settings?.notifications?.enabled || false;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: notificationsEnabled ? '🔕 Disable Notifications' : '🔔 Enable Notifications',
              callback_data: 'toggle_notifications',
            },
          ],
          [{ text: '↩️ Back', callback_data: 'wallet_settings' }],
        ],
      };

      await this.bot.sendMessage(
        chatId,
        `*Notification Settings* 🔔\n\nCurrent status: ${notificationsEnabled ? '✅ Enabled' : '❌ Disabled'}`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
      return true;
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
      return false;
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
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: 'notification_settings' }]] },
        }
      );
      return true;
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
      return true;
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
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: 'wallet_settings' }]] },
        }
      );
      return true;
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
      return true;
    }
  }

  /** Switch Network */
  async switchNetwork(chatId, userInfo, network) {
    try {
      await networkState.updateUserNetwork(userInfo.id, network);

      await this.bot.sendMessage(
        chatId,
        `✅ Network switched to *${network.toUpperCase()}* successfully.`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '↩️ Back', callback_data: 'wallet_settings' }]] } }
      );
      return true;
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
      return true;
    }
  }

  /** Utility: Set User State */
  async setState(userId, state) {
    try {
      await User.updateOne({ telegramId: userId }, { $set: { state } });
    } catch (error) {
      console.error(`Failed to update user state for ${userId}:`, error.message);
    }
  }

  /** Utility: Store Temporary User Data */
  async setUserData(userId, data) {
    try {
      await User.updateOne({ telegramId: userId }, { $set: { tempData: data } });
    } catch (error) {
      console.error(`Failed to set user data for ${userId}:`, error.message);
    }
  }
}
