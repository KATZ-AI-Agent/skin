import { quickNodeService } from '../../quicknode/QuickNodeService.js';
import { walletService } from '../../wallet/index.js';
import { TransactionValidator } from '../TransactionValidator.js';
import { ErrorHandler } from '../../../core/errors/index.js';

export class TransactionProcessor {
  constructor(queue) {
    this.queue = queue;
  }

  async processTransaction(tx) {
    try {
      // Validate transaction format
      TransactionValidator.validateTransaction(tx);

      // Validate user and get wallet info
      const { wallet, slippage } = await TransactionValidator.validateUserAndWallet(tx.userId);

      // Check balance
      const balance = await walletService.getBalance(tx.userId, wallet.address);
      if (balance < tx.estimatedGas) {
        throw new Error('❌ Insufficient balance for gas');
      }

      // Process based on network
      if (tx.network === 'solana') {
        return this.processSolanaTransaction(tx, wallet, slippage);
      } else {
        return this.processEvmTransaction(tx);
      }

    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async processSolanaTransaction(tx, wallet, slippage) {
    try {
      // Get priority fee estimate
      const priorityFee = await quickNodeService.fetchEstimatePriorityFees();

      // Prepare smart transaction
      const smartTx = await quickNodeService.prepareSmartTransaction({
        transaction: tx.transaction,
        priorityFee,
        options: {
          slippage,
          maxRetries: 3,
          skipPreflight: false
        }
      });

      // Send transaction
      const result = await quickNodeService.sendSmartTransaction(smartTx);

      // Update status
      this.queue._updateTransactionStatus(tx.id, 'complete', result);

      return {
        success: true,
        hash: result.signature,
        status: 'confirmed'
      };

    } catch (error) {
      this.queue._updateTransactionStatus(tx.id, 'failed', null, error.message);
      throw error;
    }
  }

  async processEvmTransaction(tx) {
    try {
      const provider = await walletService.getProvider(tx.network);
      const result = await provider.sendTransaction(tx.transaction);
      
      this.queue._updateTransactionStatus(tx.id, 'complete', result);
      
      return {
        success: true,
        hash: result.hash,
        status: result.status
      };
    } catch (error) {
      this.queue._updateTransactionStatus(tx.id, 'failed', null, error.message);
      throw error;
    }
  }
}