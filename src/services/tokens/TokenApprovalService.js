import { walletService } from '../wallet/index.js';
import { ErrorHandler } from '../../core/errors/index.js';
import { EventEmitter } from 'events';
import { circuitBreakers } from '../../core/circuit-breaker/index.js';
import { BREAKER_CONFIGS } from '../../core/circuit-breaker/index.js';

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function totalSupply() view returns (uint256)'
];

class TokenApprovalService extends EventEmitter {
  constructor() {
    super();
    this.approvalCache = new Map();
    this.cacheDuration = 3600000; // 1 hour
  }

  async checkAllowance(network, params) {
    const { tokenAddress, ownerAddress, spenderAddress } = params;
    const cacheKey = `${network}:${tokenAddress}:${ownerAddress}:${spenderAddress}`;
    
    const cached = this.approvalCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data;
    }

    return circuitBreakers.executeWithBreaker(
      'network',
      async () => {
        try {
          const provider = await walletService.getProvider(network);
          const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
          
          const [allowance, totalSupply] = await Promise.all([
            contract.allowance(ownerAddress, spenderAddress),
            contract.totalSupply()
          ]);

          const result = {
            hasApproval: allowance.gt(0),
            currentAllowance: allowance.toString(),
            isMaxApproval: allowance.eq(totalSupply),
            timestamp: Date.now()
          };

          this.approvalCache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
          });

          return result;
        } catch (error) {
          await ErrorHandler.handle(error);
          throw error;
        }
      },
      BREAKER_CONFIGS.network
    );
  }

  async approveToken(network, params) {
    const { tokenAddress, spenderAddress, amount, walletAddress } = params;
    
    return circuitBreakers.executeWithBreaker(
      'network',
      async () => {
        try {
          const provider = await walletService.getProvider(network);
          const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
          
          // Get gas estimate first
          const gasEstimate = await contract.approve.estimateGas(spenderAddress, amount);
          const gasPrice = await provider.getGasPrice();
          
          const tx = await contract.approve(spenderAddress, amount, {
            gasLimit: (gasEstimate * BigInt(12) / BigInt(10)).toString(), // Add 20% buffer
            gasPrice
          });

          const receipt = await tx.wait();
          
          // Clear cache for this approval
          const cacheKey = `${network}:${tokenAddress}:${walletAddress}:${spenderAddress}`;
          this.approvalCache.delete(cacheKey);

          return {
            success: true,
            hash: receipt.transactionHash,
            allowance: amount,
            gasUsed: receipt.gasUsed.toString(),
            effectiveGasPrice: receipt.effectiveGasPrice.toString()
          };
        } catch (error) {
          await ErrorHandler.handle(error);
          throw error;
        }
      },
      BREAKER_CONFIGS.network
    );
  }

  async revokeApproval(network, params) {
    return this.approveToken(network, {
      ...params,
      amount: '0'
    });
  }

  cleanup() {
    this.approvalCache.clear();
    this.removeAllListeners();
  }
}

export const tokenApprovalService = new TokenApprovalService();