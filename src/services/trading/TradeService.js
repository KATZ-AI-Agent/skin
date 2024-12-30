import { walletService } from '../wallet/index.js';
import { tokenService } from '../wallet/TokenService.js';
import { gasEstimationService } from '../gas/GasEstimationService.js';
import { tokenApprovalService } from '../tokens/TokenApprovalService.js';
import { ErrorHandler } from '../../core/errors/index.js';
import { EventEmitter } from 'events';

export class TradeService extends EventEmitter {
  constructor() {
    super();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;
  }

  /**
   * Execute a trade with standardized parameters
   * @param {Object} params Trade parameters
   * @param {string} params.network Network to execute on (ethereum/base/solana)
   * @param {string} params.action Trade action (buy/sell)
   * @param {string} params.tokenAddress Token contract address
   * @param {string} params.amount Amount to trade
   * @param {string} params.walletAddress Wallet address to trade from
   * @param {Object} [params.options] Optional parameters
   * @param {number} [params.options.slippage] Slippage tolerance
   * @param {boolean} [params.options.autoApprove] Auto-approve tokens for EVM
   * @returns {Promise<Object>} Trade result with hash and price
   */
  
  async executeTrade(params) {
    try { 
      this.validateTradeParams(params);

      // Pre-execution validation
      const validationResult = await quickNodeService.simulateTransaction({
        ...params,
        dryRun: true 
      });
  
      if (!validationResult.success) {
        throw new Error(`Trade validation failed: ${validationResult.error}`);
      }

      // Build transaction based on network
      const tx = params.network === 'solana' 
        ? await this.buildSolanaTransaction(params)
        : await this.buildEvmTransaction(params);

      // Queue transaction
      return await transactionQueue.addTransaction({
        id: `trade_${params.tokenAddress}_${Date.now()}`,
        type: params.action,
        network: params.network,
        userId: params.userId,
        tokenAddress: params.tokenAddress,
        amount: params.amount,
        transaction: tx,
        priority: 2, // High priority
        options: params.options
      });

    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async buildSolanaTransaction(params) {
    // Add gas estimation
    const priorityFee = await quickNodeService.fetchEstimatePriorityFees();
    const gasEstimate = await quickNodeService.estimateGas(params);
  
    // Prepare transaction with proper fees
    const smartTx = await quickNodeService.prepareSmartTransaction({
      ...params,
      priorityFee,
      gasLimit: gasEstimate.gasLimit,
      options: {
        maxRetries: 3,
        skipPreflight: false,
        simulation: {
          enabled: true,
          replaceOnFailure: true
        }
      }
    });
  
    return smartTx;
  } 

  async buildEvmTransaction(params) {
    // Add EVM transaction building logic
    const provider = await walletService.getProvider(params.network);
    // Build EVM transaction
    return tx;
  }

  //Jito Bulk Txns Implementation
  async executeMultipleSwaps(swaps) {
    try {
      // Validate all swaps are on Solana
      if (!swaps.every(swap => swap.network === 'solana')) {
        throw new Error('Multiple swaps only supported on Solana');
      }

      // Build all transactions
      const transactions = await Promise.all(
        swaps.map(swap => this.buildSolanaTransaction(swap))
      );

      // Create bundle of smart transactions
      const smartTxns = await Promise.all(
        transactions.map(tx => quickNodeService.prepareSmartTransaction(tx))
      );

      // Send bundle
      const results = await Promise.all(
        smartTxns.map(tx => quickNodeService.sendSmartTransaction(tx))
      );

      return results.map((result, i) => ({
        swap: swaps[i],
        success: true,
        hash: result.signature
      }));

    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async executeEvmTrade(provider, params) {
    // 1. Check and handle token approvals for EVM
    if (params.action === 'sell' && params.options?.autoApprove) {
      const approved = await tokenApprovalService.checkAllowance(params.network, {
        tokenAddress: params.tokenAddress,
        ownerAddress: params.walletAddress,
        spenderAddress: provider.routerAddress
      });

      if (!approved.hasApproval) {
        await tokenApprovalService.approveToken(params.network, {
          tokenAddress: params.tokenAddress,
          spenderAddress: provider.routerAddress,
          amount: params.amount,
          walletAddress: params.walletAddress
        });
      }
    }

    // 2. Build the swap transaction
    const swapTx = await provider.buildSwapTransaction({
      ...params,
      slippage: params.options?.slippage
    });

    // 3. Send the transaction
    const receipt = await provider.sendTransaction(swapTx);

    return {
      hash: receipt.hash,
      price: receipt.effectivePrice,
      gasUsed: receipt.gasUsed.toString(),
      success: true
    };
  }

  async executeSolanaTrade(provider, params) {
    // 1. Build the Solana swap instruction
    const swapIx = await provider.buildSwapInstruction({
      ...params,
      slippage: params.options?.slippage
    });

    // 2. Send and confirm transaction
    const signature = await provider.sendTransaction(swapIx);

    return {
      hash: signature,
      price: swapIx.effectivePrice,
      success: true
    };
  }

  validateTradeParams(params) {
    const required = ['network', 'action', 'tokenAddress', 'amount', 'walletAddress'];
    const missing = required.filter(field => !params[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required parameters: ${missing.join(', ')}`);
    }

    if (!['buy', 'sell'].includes(params.action)) {
      throw new Error('Invalid action. Must be "buy" or "sell"');
    }

    if (!['ethereum', 'base', 'solana'].includes(params.network)) {
      throw new Error('Invalid network');
    }
  }
}

export const tradeService = new TradeService();