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
      return await this.client.transaction.prepare({
        transaction: tx,
        priorityFee
      });
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async sendSmartTransaction(smartTx) {
    try {
      return await this.client.transaction.send(smartTx);
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

  async cleanup() {
    this.client = null;
    this.initialized = false;
    this.removeAllListeners();
  }
}

export const quickNodeService = new QuickNodeService();