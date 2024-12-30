console.log('✅ WalletService module is being loaded...');

import { User } from '../../models/User.js';
import { EVMProvider } from './wallets/evm.js';
import { SolanaWallet } from './wallets/solana.js';
import { NETWORKS } from '../../core/constants.js';
import { config } from '../../core/config.js';
import { db } from '../../core/database.js';
import { encrypt, decrypt } from '../../utils/encryption.js';
import { EventEmitter } from 'events';
import { ErrorHandler } from '../../core/errors/index.js';

class WalletService extends EventEmitter {
    constructor() {
      super();
      this.walletProviders = {}; // Registry for providers
      this.walletCache = new Map();
      this.isInitialized = false;
      this.initializationPromise = null; 
    }

    async initialize() {
      if (this.initializationPromise) {
        return this.initializationPromise;
      }

      this.initializationPromise = (async () => {
        try {
          // Initialize database connection
          await db.connect();
          const database = db.getDatabase();
          
          // Initialize collections using Mongoose models
          this.usersCollection = database.collection('users');
          this.metricsCollection = database.collection('walletMetrics');

          // Initialize providers
          const networks = {
            [NETWORKS.ETHEREUM]: config.networks.ethereum,
            [NETWORKS.BASE]: config.networks.base,
            [NETWORKS.SOLANA]: config.networks.solana,
          };

          for (const [network, networkConfig] of Object.entries(networks)) {
            if (network === NETWORKS.SOLANA) {
              const solanaProvider = new SolanaWallet(networkConfig);
              await solanaProvider.initialize();
              this.walletProviders[network] = solanaProvider;
            } else {
              const evmProvider = new EVMProvider(networkConfig);
              await evmProvider.initialize();
              this.walletProviders[network] = evmProvider;
            }
          }

          console.log('✅ All providers initialized successfully.');

          // Mark as initialized
          this.isInitialized = true;
          return true;
        } catch (error) {
          console.error('❌ Error initializing WalletService:', error);
          throw error;
        }
      })();

      return this.initializationPromise;
    }

    async getProvider(network) {
      if (!this.isInitialized) {
        throw new Error('WalletService is not initialized. Call initialize() before use.');
      }

      const provider = this.walletProviders[network];
      if (!provider) {
        throw new Error(`No provider found for network: ${network}`);
      }

      return provider;
    }

    async executeTrade(network, params) {
      return tradeService.executeTrade({
        network,
        ...params,
        options: {
          autoApprove: true // Enable auto-approval by default
        }
      });
    }

    async getWallets(userId) {
      try {
        // Ensure WalletService is initialized
        if (!this.isInitialized) {
          throw new Error('WalletService is not initialized. Call initialize() before use.');
        }

        const supportedNetworks = ['ethereum', 'base', 'solana'];

        // Fetch user document
        const user = await User.findOne({ telegramId: userId.toString() }).lean();
        if (!user) {
          console.warn(`⚠️ No user found with ID: ${userId}`);
          return [];
        }

        console.log(`🔍 Fetched user data for ID ${userId}:`, JSON.stringify(user, null, 2));

        const wallets = [];
        for (const network of supportedNetworks) {
          const networkWallets = user.wallets?.[network] || [];
          wallets.push(
            ...networkWallets.map((wallet) => ({
              ...wallet,
              network, // Include network for context
            }))
          );
        }

        console.log(`✅ Retrieved wallets for user ${userId}:`, wallets);
        return wallets;
      } catch (error) {
        console.error(`❌ Error fetching wallets for user ${userId}:`, error.message);
        throw error;
      }
    }

    async getBalance(userId, address) {
      try {
        const wallet = await this.getWallet(userId, address);
        if (!wallet) {
          throw new Error('Wallet not found');
        }

        const provider = await this.getProvider(wallet.network);
        return await provider.getBalance(address);
      } catch (error) {
        console.error('Error getting balance:', error);
        throw error;
      }
    }
    
    async getWallet(userId, address) {
      try {
        const user = await User.findOne({ telegramId: userId.toString() }).lean(); // Use lean() for plain objects
        if (!user || !user.wallets) {
          throw new Error('User not found or no wallets exist.');
        }
    
        for (const [network, wallets] of Object.entries(user.wallets)) {
          const wallet = wallets.find((w) => w.address === address);
          if (wallet) {
            return { address: wallet.address, network }; // Return only necessary fields
          }
        }
    
        throw new Error('Wallet not found.');
      } catch (error) {
        console.error('Error fetching wallet:', error.message);
        throw error;
      }
    }    

    async setAutonomousWallet(userId, address) {
      if (!this.isInitialized) {
        throw new Error('WalletService is not initialized');
      }
    
      try {
        // Fetch the wallet to determine the network
        const wallet = await this.getWallet(userId, address);
        if (!wallet) {
          throw new Error('Wallet not found');
        }
    
        // Retrieve the current value of isAutonomous
        const user = await User.findOne(
          { telegramId: userId.toString(), [`wallets.${wallet.network}`]: { $elemMatch: { address } } },
          { [`wallets.${wallet.network}.$`]: 1 }
        ).lean();
    
        if (!user || !user.wallets[wallet.network][0]) {
          throw new Error('Wallet not found');
        }
    
        const currentIsAutonomous = user.wallets[wallet.network][0].isAutonomous;
    
        // Toggle the value and update it
        const result = await User.updateOne(
          {
            telegramId: userId.toString(),
            [`wallets.${wallet.network}`]: { $elemMatch: { address } },
          },
          {
            $set: { [`wallets.${wallet.network}.$.isAutonomous`]: !currentIsAutonomous },
          }
        );
    
        if (result.matchedCount === 0) {
          throw new Error('Wallet not found or no changes made');
        }
    
        console.log(
          `✅ Successfully toggled isAutonomous for wallet ${address} to ${!currentIsAutonomous}`
        );
        return true;
      } catch (error) {
        console.error('Error toggling autonomous wallet:', error);
        throw error;
      }
    }
    
    
    async isAutonomousWallet(userId, network, address) {
        try {
            const user = await User.findOne({ telegramId: userId.toString() });
            if (!user?.wallets?.[network]) return false;

            const wallet = user.wallets[network].find(w => w.address === address);
            return wallet?.isAutonomous || false;
        } catch (error) {
            console.error('Error checking autonomous status:', error);
            return false;
        }
    }

    async deleteWallet(userId, network, address) {
        try {
            if (!this.usersCollection) {
                throw new Error('WalletService is not initialized. Call initialize() before use.');
            }

            const result = await this.usersCollection.updateOne(
                { telegramId: userId.toString() },
                { $pull: { [`wallets.${network}`]: { address } } }
            );

            if (result.modifiedCount > 0) {
                this.removeFromCache(userId, address);
                this.emit('walletDeleted', { userId, network, address });
                return true;
            }

            return false;
        } catch (error) {
            await ErrorHandler.handle(error, null, null, 'Error deleting wallet');
            throw error;
        }
    }

    cacheWallet(userId, address, walletData) {
        const key = `${userId}-${address}`;
        this.walletCache.set(key, { data: walletData, timestamp: Date.now() });
    }

    getFromCache(userId, address) {
        const key = `${userId}-${address}`;
        const cached = this.walletCache.get(key);

        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            return cached.data;
        }

        if (cached) {
            this.walletCache.delete(key);
        }

        return null;
    }

    removeFromCache(userId, address) {
        const key = `${userId}-${address}`;
        this.walletCache.delete(key);
    }

    cleanup() {
        this.walletCache.clear();
        this.removeAllListeners();
        Object.values(this.walletProviders).forEach(provider => provider.cleanup?.());
        console.log('✅ WalletService cleaned up successfully.');
    }

    async checkHealth() {
        const results = [];
        for (const [network, provider] of Object.entries(this.walletProviders)) {
            try {
                await provider.checkHealth(); // Assuming each provider has a `checkHealth` method
                results.push({ network, status: 'healthy' });
            } catch (error) {
                results.push({ network, status: 'unhealthy', error: error.message });
                console.error(`❌ Health check failed for ${network}:`, error.message);
            }
        }
        return results;
    }
}

export const walletService = new WalletService();

// Periodic cache cleanup
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of walletService.walletCache.entries()) {
        if (now - value.timestamp > walletService.CACHE_DURATION) {
            walletService.walletCache.delete(key);
        }
    }
}, (1000*60*60*24)); // Every 24 hours
