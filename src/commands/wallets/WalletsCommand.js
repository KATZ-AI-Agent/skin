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
      ['notification_settings', this.handleShowNotificationtSettings.bind(this)],
      ['slippage_settings', this.handleSlippageSettings.bind(this)],
      ['autonomous_settings', this.handleAutonomousSettings.bind(this)],
      ['toggle_autonomous', this.handleToggleAutonomous.bind(this)],
      ['adjust_eth_slippage', (q) => this.handleSlippageAdjustment(q, 'ethereum')],
      ['adjust_base_slippage', (q) => this.handleSlippageAdjustment(q, 'base')],
      ['adjust_sol_slippage', (q) => this.handleSlippageAdjustment(q, 'solana')],
      ['switch_network', this.handleSwitchNetwork.bind(this)],
      ['select_network_', this.handleNetworkSelection.bind(this)],
      ['set_autonomous_', this.handleSetAutonomous.bind(this)],
      ['wallet_', this.handleWalletDetails.bind(this)],
      ['back_to_settings', this.handleWalletSettings.bind(this)],
      ['back_to_wallets', this.handleBackToWallets.bind(this)],
      ['back_to_menu', this.handleBackToMenu.bind(this)],
    ]);
  }

  // Retrieve callback handlers
  getCallbackHandlers() {
    return this.callbackHandlers;
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
    return circuitBreakers.executeWithBreaker(
      'wallets',
      async () => {
        const chatId = query.message.chat.id;
        const action = query.data;
        const userInfo = query.from;
        // Catch some action or leak
        const handler = this.callbackHandlers.get(action);

        console.log('Processing wallet callback:', action);

        // Handle business or leak
        if (handler) {
          return await handler(query);
        }

        try {
          switch (action) {
            case 'view_wallets':
              await this.listHandler.showWalletList(chatId, userInfo, this.showLoadingMessage.bind(this));
              return true;

            case 'create_wallet':
              await this.creationHandler.showNetworkSelection(chatId, userInfo, this.showLoadingMessage.bind(this));
              return true;

            case 'wallet_settings':
              await this.settingsHandler.showWalletSettings(chatId, userInfo, this.showLoadingMessage.bind(this));
              return true;

            case 'slippage_settings':
              await this.settingsHandler.showSlippageSettings(chatId, userInfo, this.showLoadingMessage.bind(this));
              return true;

            case 'back_to_wallets':
              await this.showWalletsMenu(chatId, userInfo, this.showLoadingMessage.bind(this));
              return true;

            case 'set_autonomous_':
              await this.settingsHandler.handleAutonomousSettings(chatId, userInfo, this.showLoadingMessage.bind(this));
              return true;
            
            case 'toggle_autonomous':
              await this.settingsHandler.toggleAutonomousTrading(chatId, userInfo, this.showLoadingMessage.bind(this));
              return true;

            default:
              if (action.startsWith('select_network_')) {
                const network = action.replace('select_network_', '');
                await this.creationHandler.createWallet(chatId, userInfo, network, this.showLoadingMessage.bind(this));
                return true;
              }
              
              if (action.startsWith('wallet_')) {
                const address = action.replace('wallet_', '');
                await this.detailsHandler.showWalletDetails(chatId, userInfo, address, this.showLoadingMessage.bind(this));
                return true;
              }
              
              if (action.startsWith('set_autonomous_')) {
                const address = action.replace('set_autonomous_', '');
                await this.detailsHandler.setAutonomousWallet(chatId, userInfo, address, this.showLoadingMessage.bind(this));
                return true;
              }

              if (action.startsWith('adjust_') && action.endsWith('_slippage')) {
                const network = action.replace('adjust_', '').replace('_slippage', '');
                await this.settingsHandler.handleSlippageAdjustment(chatId, userInfo, network);
                return true;
              }

              return false;
          }
        } catch (error) {
          console.warn(error);
          await ErrorHandler.handle(error, this.bot, chatId);
          return false;
        }
      },
      BREAKER_CONFIGS.botErrors
    );
  }

  // Display wallets menu
  async showWalletsMenu(chatId, userInfo) {
    const keyboard = this.createKeyboard([
      [{ text: '👛 View Wallets', callback_data: 'view_wallets' }],
      [{ text: '➕ Create Wallet', callback_data: 'create_wallet' }],
      [{ text: '⚙️ Wallet Settings', callback_data: 'wallet_settings' }],
      [{ text: '↩️ Back to Menu', callback_data: 'back_to_wallets' }],
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Wallet Management* 👛\n\nChoose an option:\n\n• View your wallets\n• Create a new wallet\n• Configure settings',
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
    return true;
  }

  // Handle specific callback actions
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

  async handleShowNotificationtSettings(query) {
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
    return await this.settingsHandler.showSwitchNetwork(chatId, query.from);
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

  async handleSetAutonomous(query) {
    const chatId = query.message.chat.id;
    const address = query.data.replace('set_autonomous_', '');
    return await this.detailsHandler.setAutonomousWallet(chatId, query.from, address);
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
