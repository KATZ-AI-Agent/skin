import { UserState } from '../utils/userState.js';
import { config } from '../core/config.js';

console.log('✅ NetworkState module is being loaded...');

class NetworkStateManager {
  constructor() {
    this.defaultNetwork = 'ethereum';
    this.networks = Object.keys(config.networks);
    this.initialized = false;
    this.initializationPromise = null;
  }

  async initialize() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        this.initialized = true;
        return true;
      } catch (error) {
        this.initialized = false;
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async getCurrentNetwork(userId) {
    await this.ensureInitialized();
    const userData = await UserState.getUserData(userId);
    return userData?.network || this.defaultNetwork;
  }

  async setCurrentNetwork(userId, network) {
    await this.ensureInitialized();
    
    if (!this.networks.includes(network)) {
      throw new Error(`Invalid network: ${network}`);
    }
    
    await UserState.setUserData(userId, { network });
  }

  getNetworkDisplay(network) {
    const networkMap = {
      ethereum: 'Ethereum',
      base: 'Base',
      solana: 'Solana'
    };
    return networkMap[network] || network;
  }

  async handleNetworkSwitch(bot, chatId, network) {
    try {
      await this.setCurrentNetwork(chatId, network);
      
      await bot.sendMessage(
        chatId,
        `Network switched to *${this.getNetworkDisplay(network)}* 🔄\n\n` +
        'All blockchain features will now use this network.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '⚙️ Back to Settings', callback_data: 'wallet_settings' },
              { text: '😼 Main Menu', callback_data: 'back_to_menu' }
            ]]
          }
        }
      );
    } catch (error) {
      console.error('Error switching network:', error);
      throw error;
    }
  }

  async showNetworkSelection(bot, chatId) {
    try {
      const currentNetwork = await this.getCurrentNetwork(chatId);
      const buttons = this.networks.map(network => ({
        text: network === currentNetwork ? 
          `${this.getNetworkDisplay(network)} ✓` : 
          this.getNetworkDisplay(network),
        callback_data: `network_${network}`
      }));

      await bot.sendMessage(
        chatId,
        '*Select Network* 🌐\n\n' +
        'Choose the blockchain network to use:\n\n' +
        '_This will affect all blockchain operations_',
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              buttons,
              [{ text: '↩️ Back', callback_data: 'back_to_wallets' }]
            ]
          }
        }
      );
    } catch (error) {
      console.error('Error showing network selection:', error);
      throw error;
    }
  }

  // Cleanup method
  async cleanup() {
    this.walletCache.clear();
    this.initialized = false;
    this.initializationPromise = null;
    this.emit('cleanup');
  }
}

export const networkState = new NetworkStateManager();
