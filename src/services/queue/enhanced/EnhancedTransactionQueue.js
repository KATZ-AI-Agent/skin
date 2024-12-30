import PQueue from 'p-queue';
import { retryManager } from '../RetryManager.js';
import { ErrorHandler } from '../../../core/errors/index.js';
import { quickNodeService } from '../../quicknode/QuickNodeService.js';

export class EnhancedTransactionQueue {
  constructor() {
    this.highPriorityQueue = new PQueue({ concurrency: 1 });
    this.normalQueue = new PQueue({ concurrency: 3 });
    this.retryManager = retryManager;
    this.transactions = new Map();
  }

  async addTransaction(tx, priority = 'normal') {
    const queue = priority === 'high' ? this.highPriorityQueue : this.normalQueue;
    
    return this.retryManager.executeWithRetry(async () => {
      try {
        // Prepare transaction with QuickNode
        const smartTx = await quickNodeService.prepareSmartTransaction({
          transaction: tx.transaction,
          options: {
            maxRetries: 3,
            skipPreflight: false
          }
        });

        // Add to queue
        const result = await queue.add(() => this.processTx(smartTx));
        return result;
      } catch (error) {
        await ErrorHandler.handle(error);
        throw error;
      }
    });
  }

  async processTx(smartTx) {
    try {
      const result = await quickNodeService.sendSmartTransaction(smartTx);
      return result;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }
}

export const enhancedQueue = new EnhancedTransactionQueue();