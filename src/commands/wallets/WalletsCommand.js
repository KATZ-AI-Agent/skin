import { Command } from '../base/Command.js';
import { User } from '../../models/User.js';
import { WalletDetailsHandler } from './handlers/WalletDetailsHandler.js';
import { SettingsHandler } from './handlers/WalletListHandler.js';
import { WalletCreationHandler } from './handlers/WalletCreationHandler.js';
import { WalletSettingsHandler } from './handlers/SettingsHandler.js';
import { ErrorHandler } from '../../core/errors/index.js';
import { circuitBreakers } from '../../core/circuit-breaker/index.js';
import { BREAKER_CONFIGS } from '../../core/circuit-breaker/index.js';
import { walletService } from '../../services/wallet/index.js';
import { networkState } from '../../services/networkState.js';

export class WalletsCommand extends Command {
  constructor(bot) {
    super(bot);
    this.command = '/wallets';
    this.description = 'Manage wallets';
    this.pattern = /^(\/wallets|👛 Wallets)$/;

    // Initialize wallet service
    this.initializeWalletService();

    // Initialize modules so we can call functions from them
    this.detailsHandler = new WalletDetailsHandler(bot);
    this.listHandler = new SettingsHandler(bot);
    this.creationHandler = new WalletCreationHandler(bot);
    this.settingsHandler = new WalletSettingsHandler(bot);

    // Map callback handlers
    this.callbackHandlers = new Map([
      ['view_wallets', this.handleViewWallets.bind(this)],
      ['create_wallet', this.handleCreateWallet.bind(this)],
      ['wallet_settings', this.handleWalletSettings.bind(this)],
      ['back_to_wallets', this.handleBackToWallets.bind(this)],
      ['notification_settings', this.handleShowNotificationSettings.bind(this)],
      ['slippage_settings', this.handleSlippageSettings.bind(this)],
      ['autonomous_settings', this.handleAutonomousSettings.bind(this)],
      ['toggle_autonomous', this.handleToggleAutonomous.bind(this)],
      ['adjust_eth_slippage', (q) => this.handleSlippageAdjustment(q, 'ethereum')],
      ['adjust_base_slippage', (q) => this.handleSlippageAdjustment(q, 'base')],
      ['adjust_sol_slippage', (q) => this.handleSlippageAdjustment(q, 'solana')],
      ['butler_assistant', this.handleButlerToggle.bind(this)],
      
      
      ['network_', this.handleAdoptNetwork.bind(this)],
      ['switch_network', this.handleSwitchNetwork.bind(this)],
      ['select_network_ethereum', (q) => this.handleNetworkSelection(q, 'ethereum')],
      ['select_network_base', (q) => this.handleNetworkSelection(q, 'base')],
      ['select_network_solana', (q) => this.handleNetworkSelection(q, 'solana')],
      ['set_autonomous_', this.handleSetAutonomous.bind(this)],
      ['wallet_', this.handleWalletDetails.bind(this)],
      ['token_', this.handleTokenDetails.bind(this)],
      ['send_token_', this.handleSendToken.bind(this)],
      ['back_to_wallet_', this.handleBackToWallet.bind(this)],
      ['back_to_settings', this.handleWalletSettings.bind(this)],
      ['back_to_wallets', this.handleBackToWallets.bind(this)],
      ['back_to_menu', this.handleBackToMenu.bind(this)],
    ]);
  }

  // Initialize wallet service
  async initializeWalletService() {
    try {
      if (!walletService.isInitialized) {
        await walletService.initialize();
      }
    } catch (error) {
      console.error('Failed to initialize wallet service:', error);
    }
  }

  // Retrieve callback handlers
  getCallbackHandlers() {
    return this.callbackHandlers;
  }

  // Execute main command
  async execute(msg) {
    return circuitBreakers.executeWithBreaker(
      'wallets',
      async () => {
        const chatId = msg.chat.id;
        try {
          await this.showWalletsMenu(chatId, msg.from);
        } catch (error) {
          await ErrorHandler.handle(error, this.bot, chatId);
        }
      },
      BREAKER_CONFIGS.botErrors
    );
  }

  // Handle callback queries
  async handleCallback(query) {
    const action = query.data;

    if (action.startsWith('network_')) {
      return this.handleAdoptNetwork(query);
    } else if (action.startsWith('token_')) {
      return this.handleTokenDetails(query);
    } else if (action.startsWith('send_token_')) {
      return this.handleSendToken(query);
    } else if (action.startsWith('set_autonomous_')) {
      return this.handleSetAutonomous(query);
    } else if (action.startsWith('back_to_wallet_')) {
      return this.handleBackToWallet(query);
    }else if (action.startsWith('wallet_')) {
      const address = action.replace('wallet_', '');
      await this.handleWalletDetails(query);
      return true;
    }

    const handler = this.callbackHandlers.get(action);
    if (handler) {
      try {
        await handler(query);
        return true;
      } catch (error) {
        await ErrorHandler.handle(error, this.bot, query.message.chat.id);
      }
    }

    return false;
  }

  // Show the wallets menu
  async showWalletsMenu(chatId, userInfo) {
    const currentNetwork = await networkState.getCurrentNetwork(userInfo.id);
    const keyboard = this.createKeyboard([
      [{ text: '👛 View Wallets', callback_data: 'view_wallets' }],
      [{ text: '➕ Create Wallet', callback_data: 'create_wallet' }],
      [{ text: '🌐 Switch Network', callback_data: 'switch_network' }],
      [{ text: '⚙️ Wallet Settings', callback_data: 'wallet_settings' }],
      [{ text: '↩️ Back to Menu', callback_data: 'back_to_menu' }],
    ]);

    await this.bot.sendMessage(
      chatId,
      `*Wallet Management* 👛\n\n` +
        `Current Network: *${networkState.getNetworkDisplay(currentNetwork)}*\n\n` +
        'Choose an option:',
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
  }

  async handleViewWallets(query) {
    const chatId = query.message.chat.id;
    return await this.listHandler.showWalletList(chatId, query.from);
  }

  async handleCreateWallet(query) {
    const chatId = query.message.chat.id;
    return await this.creationHandler.showNetworkSelection(chatId, query.from);
  }

  async handleWalletSettings(query) {
    const chatId = query.message.chat.id;
    return await this.settingsHandler.showWalletSettings(chatId, query.from);
  }

  async handleShowNotificationSettings(query) {
    const chatId = query.message.chat.id;
    return await this.settingsHandler.showNotificationSettings(chatId, query.from);
  }

  async handleSlippageSettings(query) {
    const chatId = query.message.chat.id;
    return await this.settingsHandler.showSlippageSettings(chatId, query.from);
  }

  async handleAutonomousSettings(query) {
    const chatId = query.message.chat.id;
    return await this.settingsHandler.handleAutonomousSettings(chatId, query.from);
  }

  async handleToggleAutonomous(query) {
    const chatId = query.message.chat.id;
    return await this.settingsHandler.toggleAutonomousTrading(chatId, query.from);
  }

  async handleSwitchNetwork(query) {
    const chatId = query.message.chat.id;
    return await networkState.showNetworkSelection(this.bot, query.message.chat.id);
  }

  async handleAdoptNetwork(query) {
    const chatId = query.message.chat.id;
    const network = query.data.replace('network_', '');
    return await networkState.handleNetworkSwitch(this.bot, query.message.chat.id, network);    
  }

  async handleNetworkSelection(query) {
    const chatId = query.message.chat.id;
    const network = query.data.replace('select_network_', '');
    return await this.creationHandler.createWallet(chatId, query.from, network);
  }

  async handleWalletDetails(query) {
    const chatId = query.message.chat.id;
    const address = query.data.replace('wallet_', '');
    return await this.detailsHandler.showWalletDetails(chatId, query.from, address);
  }

  async handleTokenDetails(query) {
    const chatId = query.message.chat.id;
    const [_, tokenAddress] = query.data.split('_');
    return await this.detailsHandler.showTokenDetails(chatId, query.from, tokenAddress);
  }

  async handleSendToken(query) {
    const chatId = query.message.chat.id;
    const [_, tokenAddress] = query.data.split('_');
    return await this.detailsHandler.showSendTokenMenu(chatId, query.from, tokenAddress);
  }

  async handleSetAutonomous(query) {
    const chatId = query.message.chat.id;
    const address = query.data.replace('set_autonomous_', '');
    return await this.detailsHandler.setAutonomousWallet(chatId, query.from, address);
  }

  async handleButlerToggle(query) {
    const chatId = query.message.chat.id;    
    return await this.settingsHandler.toggleButlerAssistant(chatId, query.from);
  }

  async handleBackToWallet(query) {
    const chatId = query.message.chat.id;
    const address = query.data.replace('back_to_wallet_', '');
    return await this.detailsHandler.showWalletDetails(chatId, query.from, address);
  }

  async handleBackToWallets(query) {
    const chatId = query.message.chat.id;
    return await this.showWalletsMenu(chatId, query.from);
  }

  async handleBackToMenu(query) {
    const chatId = query.message.chat.id;
    return await this.showWalletsMenu(chatId, query.from);
  }
}
