/*====================================================================================================


            ALCHEMY BASED EMV PROVIDER ONLY


=====================================================================================================*/


import { ethers } from 'ethers';
import { Alchemy } from 'alchemy-sdk';
import axios from 'axios';
import { circuitBreakers, BREAKER_CONFIGS } from '../../../core/circuit-breaker/index.js';

const DEFAULT_GAS_CACHE_TTL = 12000; // 12 seconds cache
const NETWORK_CONFIGS = {
  ethereum: {
    chainId: 1,
    name: 'eth-mainnet',
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
  },
  base: {
    chainId: 8453,
    name: 'base-mainnet',
    ensAddress: null,
  },
};

export class EVMProvider {
  constructor(networkConfig) {
    if (!networkConfig?.rpcUrl) {
      throw new Error('❌ Invalid network configuration: RPC URL is required');
    }

    this.networkConfig = networkConfig;
    this.networkName = networkConfig.name.toLowerCase();
    this.provider = null;
    this.alchemy = null;
    this.fallbackProviders = [];
    this.gasPriceCache = {
      price: null,
      timestamp: 0,
      ttl: DEFAULT_GAS_CACHE_TTL,
    };
  }

  /** Initialize the provider and fallback mechanisms */
  async initialize() {
    try {
      console.log(`🔄 Initializing EVMProvider for network: ${this.networkConfig.name}...`);

      const networkInfo = NETWORK_CONFIGS[this.networkName] || {
        chainId: this.networkConfig.chainId,
        name: this.networkName,
      };

      // Main provider
      this.provider = new ethers.JsonRpcProvider(this.networkConfig.rpcUrl, {
        chainId: networkInfo.chainId,
        name: networkInfo.name,
        ensAddress: networkInfo.ensAddress,
      });

      // Fallback providers
      if (this.networkConfig.fallbackRpcUrls?.length) {
        this.fallbackProviders = this.networkConfig.fallbackRpcUrls.map(
          (url) => new ethers.JsonRpcProvider(url, networkInfo)
        );
      }

      // Initialize Alchemy (if API key provided)
      if (this.networkConfig.alchemyApiKey) {
        this.alchemy = new Alchemy({
          apiKey: this.networkConfig.alchemyApiKey,
          network: networkInfo.name,
        });
      }

      const blockNumber = await this.getBlockNumber();
      console.log(`✅ EVMProvider initialized. Latest Block: ${blockNumber}`);
      return true;
    } catch (error) {
      console.error(`❌ Error initializing EVMProvider: ${error.message}`);
      throw error;
    }
  }

  /** Fetch the latest gas price with fallback mechanisms */
  async getGasPrice() {
    return circuitBreakers.executeWithBreaker(
      'network',
      async () => {
        try {
          if (this.isGasPriceCacheValid()) {
            return this.gasPriceCache.price;
          }

          const gasPrice = await this._fetchGasPriceWithFallback();

          // Update cache
          this.gasPriceCache = {
            price: gasPrice,
            timestamp: Date.now(),
            ttl: DEFAULT_GAS_CACHE_TTL,
          };

          return gasPrice;
        } catch (error) {
          console.error(`❌ Error fetching gas price: ${error.message}`);
          throw error;
        }
      },
      BREAKER_CONFIGS.network
    );
  }

  /** Core gas price fetching logic with fallback mechanisms */
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

  /** Check if cached gas price is valid */
  isGasPriceCacheValid() {
    return (
      this.gasPriceCache.price &&
      Date.now() - this.gasPriceCache.timestamp < this.gasPriceCache.ttl
    );
  }

  /** Get the latest block number */
  async getBlockNumber() {
    return this.provider.getBlockNumber();
  }

  /** Estimate gas for a transaction */
  async estimateGas(transaction) {
    try {
      const gasEstimate = await this.provider.estimateGas(transaction);
      const gasPrice = await this.getGasPrice();

      const totalCost = BigInt(gasEstimate) * BigInt(gasPrice.price);
      return {
        gasLimit: gasEstimate.toString(),
        gasPrice: gasPrice.price,
        totalCost: totalCost.toString(),
        formatted: `${ethers.formatEther(totalCost)} ETH`,
      };
    } catch (error) {
      console.error('❌ Error estimating gas:', error.message);
      throw error;
    }
  }

  /** Send a signed transaction */
  async sendTransaction(signedTransaction) {
    try {
      const tx = await this.provider.broadcastTransaction(signedTransaction);
      return await tx.wait();
    } catch (error) {
      console.error('❌ Error sending transaction:', error.message);
      throw error;
    }
  }

  /** Cleanup resources */
  async cleanup() {
    try {
      this.provider = null;
      this.fallbackProviders = [];
      this.alchemy = null;
      this.gasPriceCache = { price: null, timestamp: 0, ttl: DEFAULT_GAS_CACHE_TTL };
      console.log(`🧹 Cleaned up EVMProvider for ${this.networkConfig.name}`);
    } catch (error) {
      console.error('❌ Error during cleanup:', error.message);
    }
  }

  async getBlockNumber() {
    try {
      // First try using provider
      if (this.provider) {
        const blockNumber = await this.provider.getBlockNumber();
        return blockNumber;
      }

      // Fallback to direct RPC call
      const response = await axios.post(this.networkConfig.rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: []
      });

      if (!response.data?.result) {
        throw new Error('Invalid response from RPC endpoint');
      }

      return parseInt(response.data.result, 16);
    } catch (error) {
      console.error('Error getting block number:', error);
      throw error;
    }
  }

  async getTransactionReceipt(txHash) {
    return circuitBreakers.executeWithBreaker(
      'network',
      async () => {
        try {
          return await this.provider.getTransactionReceipt(txHash);
        } catch (error) {
          console.error('Error getting transaction receipt:', error);
          throw error;
        }
      },
      BREAKER_CONFIGS.network
    );
  }

  async validateTransaction(transaction) {
    try {
      const [gasEstimate, balance] = await Promise.all([
        this.estimateGas(transaction),
        this.provider.getBalance(transaction.from)
      ]);

      const totalCost = BigInt(gasEstimate.totalCost);
      const hasEnoughBalance = balance >= totalCost;

      return {
        isValid: hasEnoughBalance,
        estimatedCost: gasEstimate.formatted,
        balance: ethers.formatEther(balance),
        errors: hasEnoughBalance ? [] : ['Insufficient balance for gas']
      };
    } catch (error) {
      console.error('Error validating transaction:', error);
      throw error;
    }
  }

  // ======================================================================
  // OLD FUNCTIONS FROM PREVIOUS evm.js
  async createWallet() {
    try {
      const wallet = ethers.Wallet.createRandom();
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic.phrase
      };
    } catch (error) {
      console.error('❌ Error creating EVM wallet:', error.message);
      throw error;
    }
  }

  async getBalance(address) {
    try {
      const response = await this.axiosInstance.post('', {
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1
      });

      if (!response.data?.result) {
        throw new Error('Invalid balance response');
      }

      return ethers.formatEther(response.data.result);
    } catch (error) {
      console.error(`❌ Error getting EVM balance for ${address}:`, error.message);
      throw error;
    }
  }

  async getTokenBalance(address, tokenAddress) {
    try {
      // Get token decimals first
      const decimalsResponse = await this.axiosInstance.post('', {
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: tokenAddress,
          data: '0x313ce567' // decimals()
        }, 'latest'],
        id: 1
      });

      const decimals = parseInt(decimalsResponse.data.result, 16);

      // Get balance
      const response = await this.axiosInstance.post('', {
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: tokenAddress,
          data: `0x70a08231000000000000000000000000${address.slice(2)}` // balanceOf(address)
        }, 'latest'],
        id: 2
      });

      if (!response.data?.result) {
        throw new Error('Invalid token balance response');
      }

      const balance = BigInt(response.data.result);
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      console.error(`❌ Error getting token balance for ${address}:`, error.message);
      throw error;
    }
  }

  async signTransaction(transaction, privateKey) {
    try {
      const wallet = new ethers.Wallet(privateKey);
      const signedTx = await wallet.signTransaction(transaction);
      return signedTx;
    } catch (error) {
      console.error('❌ Error signing transaction:', error.message);
      throw error;
    }
  }

  async cleanup() {
    try {
      if (this.provider) {
        await this.provider.destroy();
        this.provider = null;
      }

      // Cleanup fallback providers
      for (const provider of this.fallbackProviders) {
        await provider.destroy();
      }
      this.fallbackProviders = [];

      // Clear cache
      this.gasPriceCache = {
        price: null,
        timestamp: 0,
        ttl: 12000
      };

      console.log(`✅ Cleaned up EVMProvider for ${this.networkConfig.name}`);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}