import { QuickNode } from '@quicknode/sdk';
import { config } from '../../core/config.js';
import { ErrorHandler } from '../../core/errors/index.js';
import { EventEmitter } from 'events';

class QuickNodeService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      this.client = new QuickNode({
        apiKey: config.quickNode.apiKey,
        network: config.quickNode.network
      });
      
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
      
      // Prepare transaction with QuickNode's smart routing
      const preparedTx = await this.client.transaction.prepare({
        transaction: tx.transaction,
        options: {
          maxRetries: tx.options?.maxRetries || 3,
          skipPreflight: tx.options?.skipPreflight || false,
          priorityFee,
          simulation: {
            enabled: true,
            replaceOnFailure: true
          }
        }
      });

      return preparedTx;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async simulateTransaction(smartTx) {
    try {
      const simulation = await this.client.transaction.simulate(smartTx);
      
      return {
        success: !simulation.error,
        error: simulation.error,
        logs: simulation.logs,
        unitsConsumed: simulation.unitsConsumed,
        returnData: simulation.returnData
      };
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async sendSmartTransaction(smartTx) {
    try {
      // Send with QuickNode's smart routing
      const result = await this.client.transaction.send(smartTx, {
        skipPreflight: false,
        maxRetries: 3
      });

      return {
        signature: result.signature,
        slot: result.slot,
        success: true
      };
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async subscribeToTokenUpdates(tokenAddress, callback) {
    try {
      const subscription = await this.client.ws.subscribe(
        'token-updates',
        { address: tokenAddress },
        callback
      );

      return subscription;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async setupPriceOracle(tokenAddress) {
    try {
      const oracle = await this.client.token.createPriceOracle(tokenAddress, {
        updateInterval: 1000, // 1 second updates
        sources: ['jupiter', 'raydium'] // Use multiple DEXes
      });

      return oracle;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async fetchEstimatePriorityFees() {
    try {
      const { min, max, median } = await this.client.solana.getPriorityFeeEstimate();
      return median; // Use median as default
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async estimateGas(params) {
    try {
      const estimate = await this.client.transaction.estimateGas({
        ...params,
        simulation: {
          enabled: true
        }
      });

      return {
        gasLimit: estimate.gasLimit,
        priorityFee: estimate.priorityFee,
        totalCost: estimate.totalCost
      };
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async getTokenMetadata(tokenAddress) {
    try {
      return await this.client.token.getMetadata(tokenAddress);
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async getTokenLiquidity(tokenAddress) {
    try {
      const pools = await this.client.token.getLiquidityPools(tokenAddress);
      return pools.reduce((total, pool) => total + pool.liquidityUSD, 0);
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async cleanup() {
    this.client = null;
    this.initialized = false;
    this.removeAllListeners();
  }
}

export const quickNodeService = new QuickNodeService();