import { walletService } from '../wallet/index.js';
import { ErrorHandler } from '../../core/errors/index.js';
import { EventEmitter } from 'events';
import { circuitBreakers } from '../../core/circuit-breaker/index.js';
import { BREAKER_CONFIGS } from '../../core/circuit-breaker/index.js';

class GasEstimationService extends EventEmitter {
  constructor() {
    super();
    this.gasPriceCache = new Map();
    this.cacheDuration = 30000; // 30 seconds
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    try {
      // Ensure wallet service is initialized
      await walletService.initialize();
      this.initialized = true;
      console.log('✅ GasEstimationService initialized');
    } catch (error) {
      console.error('❌ Error initializing GasEstimationService:', error);
      throw error;
    }
  }

  async estimateGas(network, params) {
    if (!this.initialized) {
      await this.initialize();
    }

    return circuitBreakers.executeWithBreaker(
      'network',
      async () => {
        try {
          const provider = await walletService.getProvider(network);
          const [gasEstimate, gasPrice] = await Promise.all([
            provider.estimateGas(params),
            this.getGasPrice(network)
          ]);

          const totalCost = gasEstimate * BigInt(gasPrice.price);
          
          return {
            gasLimit: gasEstimate.toString(),
            gasPrice: gasPrice.price,
            totalCost: totalCost.toString(),
            formatted: network === 'solana' ? 
              `${(Number(totalCost) / 1e9).toFixed(9)} SOL` :
              `${(Number(totalCost) / 1e18).toFixed(18)} ETH`,
            network
          };
        } catch (error) {
          await ErrorHandler.handle(error);
          throw error;
        }
      },
      BREAKER_CONFIGS.network
    );
  }

  async getGasPrice(network) {
    if (!this.initialized) {
      await this.initialize();
    }

    const cached = this.gasPriceCache.get(network);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.price;
    }

    return circuitBreakers.executeWithBreaker(
      'network',
      async () => {
        try {
          const provider = await walletService.getProvider(network);
          const price = await provider.getGasPrice();

          this.gasPriceCache.set(network, {
            price,
            timestamp: Date.now()
          });

          return price;
        } catch (error) {
          await ErrorHandler.handle(error);
          throw error;
        }
      },
      BREAKER_CONFIGS.network
    );
  }

  async getRecommendedGasPrices(network) {
    if (!this.initialized) {
      await this.initialize();
    }

    return circuitBreakers.executeWithBreaker(
      'network',
      async () => {
        try {
          const basePrice = await this.getGasPrice(network);
          
          return {
            slow: basePrice.toString(),
            standard: (BigInt(basePrice) * BigInt(12) / BigInt(10)).toString(), // 1.2x
            fast: (BigInt(basePrice) * BigInt(15) / BigInt(10)).toString(), // 1.5x
            timestamp: Date.now()
          };
        } catch (error) {
          await ErrorHandler.handle(error);
          throw error;
        }
      },
      BREAKER_CONFIGS.network
    );
  }

  /** Migrated from evm.js to complement this service. Core gas price fetching logic with fallback mechanisms */
    async _fetchGasPriceWithFallback() {
        const errors = [];

        // Attempt 1: Alchemy Provider
        if (this.alchemy) {
        try {
            const gasPrice = await this.alchemy.core.getGasPrice();
            return this._formatGasPrice(gasPrice);
        } catch (error) {
            errors.push({ method: 'alchemy', error: error.message });
        }
        }

        // Attempt 2: Fallback Providers
        for (const provider of this.fallbackProviders) {
        try {
            const feeData = await provider.getFeeData();
            if (feeData?.gasPrice) return this._formatGasPrice(feeData.gasPrice);
        } catch (error) {
            errors.push({ method: 'fallbackProvider', error: error.message });
        }
        }

        // Attempt 3: Main Provider
        try {
        const feeData = await this.provider.getFeeData();
        if (feeData?.gasPrice) return this._formatGasPrice(feeData.gasPrice);
        } catch (error) {
        errors.push({ method: 'mainProvider', error: error.message });
        }

        // Attempt 4: Direct RPC Call
        try {
        const response = await axios.post(this.networkConfig.rpcUrl, {
            jsonrpc: '2.0',
            method: 'eth_gasPrice',
            params: [],
            id: 1,
        });

        if (response.data?.result) {
            const gasPrice = BigInt(response.data.result);
            return this._formatGasPrice(gasPrice);
        }
        } catch (error) {
        errors.push({ method: 'directRPC', error: error.message });
        }

        throw new Error(`All gas price fetch methods failed: ${JSON.stringify(errors)}`);
    }

    /** Format gas price to structured output */
    _formatGasPrice(gasPrice) {
        return {
        price: gasPrice.toString(),
        formatted: `${ethers.formatUnits(gasPrice, 'gwei')} Gwei`,
        };
    }

  cleanup() {
    this.gasPriceCache.clear();
    this.removeAllListeners();
    this.initialized = false;
  }
}

export const gasEstimationService = new GasEstimationService();