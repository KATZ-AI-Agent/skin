import { Core, Solana } from '@quicknode/sdk';
import { EventEmitter } from 'events';
import { ErrorHandler } from '../../core/errors/index.js';
import { config } from '../../core/config.js';

class QuickNodeService extends EventEmitter {
  constructor() {
    super();
    this.core = null;
    this.solana = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      console.log(config.quickNode.evmEndpoint)
      // Initialize Core for EVM chains
      this.core = new Core({
        endpointUrl: config.quickNode.evmEndpoint,
      });

      // Initialize Solana
      this.solana = new Solana({
        endpointUrl: config.quickNode.solanaEndpoint,
      });

      // Test connections
      await Promise.all([
        this.core.client.getBlockNumber(),
        this.solana.connection.getSlot()
      ]);

      this.initialized = true;
      console.log('✅ QuickNode service initialized');
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async prepareSmartTransaction(tx) {
    try {
      const priorityFee = await this.fetchEstimatePriorityFees();
      
      return {
        ...tx,
        priorityFee,
        options: {
          maxRetries: tx.options?.maxRetries || 3,
          skipPreflight: tx.options?.skipPreflight || false,
          simulation: {
            enabled: true,
            replaceOnFailure: true
          }
        }
      };
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async simulateTransaction(tx) {
    try {
      const simulation = await this.solana.connection.simulateTransaction(tx);
      
      return {
        success: !simulation.value.err,
        error: simulation.value.err,
        logs: simulation.value.logs,
        unitsConsumed: simulation.value.unitsConsumed
      };
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async sendSmartTransaction(smartTx) {
    try {
      const result = await this.solana.connection.sendTransaction(smartTx, {
        skipPreflight: false,
        maxRetries: 3
      });

      return {
        signature: result,
        success: true
      };
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async subscribeToTokenUpdates(tokenAddress, callback) {
    try {
      const subscription = await this.solana.connection.onAccountChange(
        new solanaWeb3.PublicKey(tokenAddress),
        callback,
        'confirmed'
      );

      return subscription;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async setupPriceOracle(tokenAddress) {
    try {
      // Use Solana connection to get token account info
      const accountInfo = await this.solana.connection.getAccountInfo(
        new solanaWeb3.PublicKey(tokenAddress)
      );

      return {
        getPrice: async () => {
          // Implement price fetching logic
          const info = await this.solana.connection.getAccountInfo(
            new solanaWeb3.PublicKey(tokenAddress)
          );
          return this.calculatePrice(info);
        }
      };
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async fetchEstimatePriorityFees() {
    try {
      const { min, max, median } = await this.solana.connection.getRecentPrioritizationFees();
      return median || min; // Use median as default, fallback to min
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async estimateGas(params) {
    try {
      if (params.network === 'solana') {
        const estimate = await this.solana.connection.getFeeForMessage(
          params.message,
          'confirmed'
        );
        return estimate;
      } else {
        return await this.core.client.estimateGas(params);
      }
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async getTokenMetadata(tokenAddress) {
    try {
      const accountInfo = await this.solana.connection.getParsedAccountInfo(
        new solanaWeb3.PublicKey(tokenAddress)
      );
      return accountInfo.value?.data?.parsed?.info;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async getTokenLiquidity(tokenAddress) {
    try {
      // Implement liquidity calculation logic
      return 0;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async cleanup() {
    try {
      // Close any active connections/subscriptions
      if (this.solana?.connection) {
        await this.solana.connection.removeAllListeners();
      }
      this.initialized = false;
      this.removeAllListeners();
      console.log('✅ QuickNode service cleaned up');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export const quickNodeService = new QuickNodeService();