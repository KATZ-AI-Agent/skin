import { Command } from '../base/Command.js';
import { SettingsHandler } from './handlers/WalletListHandler.js';
import { WalletCreationHandler } from './handlers/WalletCreationHandler.js';
import { WalletSettingsHandler } from './handlers/SettingsHandler.js';
import { WalletDetailsHandler } from './handlers/WalletDetailsHandler.js';
import { TokenDetailsHandler } from './handlers/TokenDetailsHandler.js';
import { SendTokenHandler } from './handlers/SendTokenHandler.js';
import { SwapHandler } from './handlers/SwapHandler.js';
import { USER_STATES } from '../../core/constants.js';

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
    this.tokenDetailsHandler = new TokenDetailsHandler(bot);
    this.sendTokenHandler = new SendTokenHandler(bot);
    this.swapHandler = new SwapHandler(bot);
    // Track callback processing
    this.processingCallbacks = new Set();

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


  // src/commands/wallets/WalletsCommand.js
async handleCallback(query) {
  const action = query.data;
  const chatId = query.message.chat.id;
  const userInfo = query.from;

  // Generate unique callback ID
  const callbackId = `${chatId}:${action}:${Date.now()}`;

  // Check if callback is already being processed
  if (this.processingCallbacks.has(callbackId)) {
    return true;
  }

  try {
    this.processingCallbacks.add(callbackId);

    if (action.startsWith('network_')) {
      await this.handleAdoptNetwork(query);
      return true;
    } else if (action.startsWith('send_token_')) {
      await this.handleSendToken(query);
      return true;
    } else if (action.startsWith('set_autonomous_')) {
      await this.handleSetAutonomous(query);
      return true;
    } else if (action.startsWith('back_to_wallet_')) {
      await this.handleBackToWallet(query);
      return true;
    } else if (action.startsWith('wallet_')) {
      const address = action.replace('wallet_', '');
      await this.handleWalletDetails(query);
      return true;
    } else if (action.startsWith('token_')) {
      return this.tokenDetailsHandler.showTokenDetails(chatId, userInfo, action.replace('token_', ''));
    } else if (action.startsWith('send_token_')) {
      return this.sendTokenHandler.initiateSendToken(chatId, userInfo, action.replace('send_token_', ''));
    } else if (action.startsWith('swap_token_')) {
      return await this.swapHandler.initiateSwap(chatId, userInfo, action.replace('swap_token_', ''));
    } else if (action.startsWith('swap_buy_') || action.startsWith('swap_sell_')) { 
      return await this.swapHandler.handleSwapDirection(chatId, userInfo, action);
    } else if (action === 'confirm_send_token') {
      return await this.sendTokenHandler.executeSendToken(chatId, userInfo);
    } else if (action === 'confirm_swap') {
      return await this.swapHandler.executeSwap(chatId, userInfo);
    }

    const handler = this.callbackHandlers.get(action);
    if (handler) {
      const result = await handler(query);
      this.isProcessingCallback = false;
      return result;
    }

    return false;
  } catch (error) {
    this.isProcessingCallback = false;
    await ErrorHandler.handle(error, this.bot, chatId);
    return false;
  } finally {
    // Remove callback from processing set after a delay
    setTimeout(() => {
      this.processingCallbacks.delete(callbackId);
    }, 2000);
  }
}


async handleInput(msg) {
  const state = await this.getState(msg.from.id);
  const chatId = msg.chat.id;
  
  try {
    switch (state) {
      case USER_STATES.WAITING_SEND_ADDRESS:
        return await this.sendTokenHandler.handleAddressInput(
          chatId,
          msg.from,
          msg.text
        );

      case USER_STATES.WAITING_SEND_AMOUNT:
        return await this.sendTokenHandler.handleAmountInput(
          chatId,
          msg.from,
          msg.text
        );

      case USER_STATES.WAITING_SWAP_AMOUNT:
        return await this.swapHandler.handleSwapAmount(
          chatId,
          msg.from,
          msg.text
        );

      default:
        return false;
    }
  } catch (error) {
    await ErrorHandler.handle(error, this.bot, chatId);
    return false;
  }
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

  async handleSendToken(query) {
    const actionParts = query.data.replace('send_token_', '').split('_');
    const [tokenAddress, network] = actionParts;
  
    return tokenAddress && network
      ? this.detailsHandler.showSendTokenMenu(query.message.chat.id, network, tokenAddress)
      : this.bot.sendMessage(query.message.chat.id, '❌ Invalid token information. Please try again.');
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
