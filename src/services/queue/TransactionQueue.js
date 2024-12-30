import PQueue from 'p-queue';
import { config } from '../../core/config.js';
import { EventEmitter } from 'events';
import { EVMProvider } from '../../services/wallet/wallets/evm.js';
import { SolanaWallet as SolanaProvider } from '../../services/wallet/wallets/solana.js';
import { gasEstimationService } from '../../services/gas/GasEstimationService.js';
import { tokenApprovalService } from '../../services/tokens/TokenApprovalService.js';
import { TransactionProcessor } from './processors/TransactionProcessor.js';
import { circuitBreakers } from '../../core/circuit-breaker/index.js';
import { BREAKER_CONFIGS } from '../../core/circuit-breaker/index.js';

class TransactionQueue extends EventEmitter {
  constructor() {
    super();

    // Initialize provider instances
    this.providers = {
      ethereum: new EVMProvider(config.networks.ethereum),
      base: new EVMProvider(config.networks.base),
      solana: new SolanaProvider(config),
    };

    // Network-specific queues
    this.queues = {};
    this._initQueues();

    // Track pending transactions
    this.processor = new TransactionProcessor(this);
    this.pendingTransactions = new Map();

    // Track gas prices
    this.gasPrices = new Map();

    // Update gas prices periodically (every 5 minutes)
    setInterval(() => this.updateGasPrices(), 300000);
  }

  /** Initialize network-specific queues */
  _initQueues() {
    const NETWORK_INTERVALS = { solana: 500, default: 1000 };

    ['ethereum', 'base', 'solana'].forEach((network) => {
      this.queues[network] = new PQueue({
        concurrency: 1,
        interval: NETWORK_INTERVALS[network] || NETWORK_INTERVALS.default,
        intervalCap: 1,
      });
    });

    this.emit('✅ Queues initialized');
  }

  /** Add a transaction to the appropriate queue */
  async addTransaction(tx) {
    try {
      this.validateTransaction(tx);

      // Add to pending transactions
      this.pendingTransactions.set(tx.id, {
        ...tx,
        status: 'pending',
        addedAt: Date.now(),
      });

      // Queue the transaction
      const result = await this.queues[tx.network].add(
        () => this.processTransaction(tx),
        { priority: tx.priority || 0 }
      );

      // Mark transaction as complete
      this._updateTransactionStatus(tx.id, 'complete', result);
      this.emit('transactionComplete', { id: tx.id, result });

      return result;
    } catch (error) {
      this._updateTransactionStatus(tx.id, 'failed', null, error.message);
      this.emit('transactionFailed', { id: tx.id, error });
      console.error(`❌ Error processing transaction ${tx.id}:`, error.message);
      throw error;
    }
  }

  /** Validate a transaction */
  validateTransaction(tx) {
    if (!tx.id || !tx.type || !tx.network || !tx.userId) {
      throw new Error('❌ Invalid transaction format');
    }
    if (!this.queues[tx.network]) {
      throw new Error(`❌ Unsupported network: ${tx.network}`);
    }
  }

  /** Process a transaction */
  async processTransaction(tx) {
    return circuitBreakers.executeWithBreaker(
      'quickNode',
      async () => {
        return await this.processor.processTransaction(tx);
      },
      BREAKER_CONFIGS.quickNode
    );
  }

  async executeMultipleOrders(orders) {
    try {
      // Sort orders by priority
      const sortedOrders = orders.sort((a, b) => b.priority - a.priority);
  
      // Process in batches of 3
      const batches = [];
      for (let i = 0; i < sortedOrders.length; i += 3) {
        batches.push(sortedOrders.slice(i, i + 3));
      }
  
      // Execute batches sequentially
      const results = [];
      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map(order => this.processTransaction(order))
        );
        results.push(...batchResults);
      }
  
      return results;
    } catch (error) {
      console.error('Error executing multiple orders:', error);
      throw error;
    }
  }  

  _updateTransactionStatus(id, status, result = null, error = null) {
    const transaction = this.pendingTransactions.get(id);
    if (transaction) {
      this.pendingTransactions.set(id, {
        ...transaction,
        status,
        result,
        error,
        completedAt: Date.now()
      });
    }
  }

  /** Update gas prices for all networks */
  async updateGasPrices() {
    const networks = Object.keys(this.queues);

    for (const network of networks) {
      try {
        const gasPrice = await gasEstimationService.getGasPrice(network);

        this.gasPrices.set(network, { price: gasPrice, timestamp: Date.now() });
        console.log(`✅ Gas price updated for ${network}:`, gasPrice);
      } catch (error) {
        console.error(`❌ Failed to update gas price for ${network}:`, error.message);
        this.gasPrices.set(network, { price: 'unavailable', timestamp: Date.now() });
      }
    }
  }

  /** Get queue status */
  getQueueStatus(network) {
    return {
      pending: this.queues[network]?.pending || 0,
      size: this.queues[network]?.size || 0,
      gasPrice: this.gasPrices.get(network)?.price || 'unavailable',
    };
  }

  /** Get pending transactions for a user */
  getPendingTransactions(userId) {
    return Array.from(this.pendingTransactions.values()).filter(
      (tx) => tx.userId === userId && tx.status === 'pending'
    );
  }

  /** Pause network queue */
  pauseNetwork(network) {
    this.queues[network]?.pause();
    this.emit('queuePaused', { network });
    console.log(`⚠️ Queue paused for ${network}`);
  }

  /** Resume network queue */
  resumeNetwork(network) {
    this.queues[network]?.start();
    this.emit('queueResumed', { network });
    console.log(`✅ Queue resumed for ${network}`);
  }

  /** Clean up all queues and pending data */
  cleanup() {
    Object.values(this.queues).forEach((queue) => queue.clear());
    this.pendingTransactions.clear();
    this.gasPrices.clear();
    this.removeAllListeners();
    console.log('🧹 Transaction queues cleaned up');
  }
}

export const transactionQueue = new TransactionQueue();

// Initialize queue
(async () => {
  try {
    await transactionQueue.providers.ethereum.initialize();
    await transactionQueue.providers.base.initialize();
    await transactionQueue.providers.solana.initialize();
  } catch (error) {
    console.error('❌ Error initializing transaction queues:', error.message);
  }
})();

// Handle cleanup on process exit
process.on('SIGINT', () => transactionQueue.cleanup());
process.on('SIGTERM', () => transactionQueue.cleanup());
