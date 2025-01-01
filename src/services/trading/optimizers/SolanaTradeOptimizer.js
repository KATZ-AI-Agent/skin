import { quickNodeService } from '../../quicknode/QuickNodeService.js';
import { ErrorHandler } from '../../../core/errors/index.js';
import { SolanaWallet } from '../../wallet/wallets/solana.js';

export class SolanaTradeOptimizer {
  constructor() {
    this.priorityFeeCache = new Map();
    this.accountCache = new Map();
  }

  async prepareTrade(params) {
    try {
      // Pre-create token accounts if needed
      await this.ensureTokenAccount(params);

      // Get optimal priority fee
      const priorityFee = await this.calculateOptimalPriorityFee();

      // Prepare transaction with optimizations
      const preparedTx = await quickNodeService.prepareSmartTransaction({
        ...params,
        priorityFee,
        options: {
          skipPreflight: false,
          maxRetries: 3
        }
      });

      // Simulate transaction
      const simulation = await this.simulateTransaction(preparedTx);
      if (!simulation.success) {
        throw new Error(`Transaction simulation failed: ${simulation.error}`);
      }

      return preparedTx;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async ensureTokenAccount(params) {
    const cacheKey = `${params.walletAddress}:${params.tokenAddress}`;
    
    if (!this.accountCache.has(cacheKey)) {
      const account = await SolanaWallet.createTokenAccountIfNeeded(
        params.walletAddress,
        params.tokenAddress
      );
      this.accountCache.set(cacheKey, account);
    }
    
    return this.accountCache.get(cacheKey);
  }

  async calculateOptimalPriorityFee() {
    try {
      const recentFees = await quickNodeService.fetchEstimatePriorityFees();
      return Math.ceil(recentFees.median * 1.2);
    } catch (error) {
      console.warn('Failed to fetch optimal fees, using fallback:', error);
      return 5000; // Fallback to 5000 lamports
    }
  }  

  async simulateTransaction(tx) {
    try {
      return await quickNodeService.simulateTransaction(tx);
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }
}

export const solanaTradeOptimizer = new SolanaTradeOptimizer();