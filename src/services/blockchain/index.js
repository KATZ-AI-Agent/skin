import { EVMProvider } from '../wallet/wallets/evm.js';
import { SolanaWallet } from '../wallet/wallets/solana.js';
import { config } from '../../core/config.js';
import { NETWORKS } from '../../core/constants.js';

/*======================================================================

          USED BY LOAN SERVICE TO ACCESS SMART CONTRACTS 
          TO BE IMPROVED TO USE ALCHEMY THROUGH WALLET SERVICE

========================================================================*/

class BlockchainService {
  constructor() {
    this.providers = {
      [NETWORKS.ETHEREUM]: new EVMProvider(config.networks.ethereum),
      [NETWORKS.BASE]: new EVMProvider(config.networks.base),
      [NETWORKS.SOLANA]: new SolanaWallet(config.networks.solana)
    };
  }

  getProvider(network) {
    const provider = this.providers[network];
    if (!provider) {
      throw new Error(`Unsupported network: ${network}`);
    }
    return provider;
  }

  async getBalance(network, address) {
    const provider = this.getProvider(network);
    return provider.getBalance(address);
  }

  async getTokenBalance(network, address, tokenAddress) {
    const provider = this.getProvider(network);
    return provider.getTokenBalance(address, tokenAddress);
  }

  async estimateGas(network, transaction) {
    const provider = this.getProvider(network);
    return provider.estimateGas(transaction);
  }

  async sendTransaction(network, signedTransaction) {
    const provider = this.getProvider(network);
    return provider.sendTransaction(signedTransaction);
  }

  async getTransactionReceipt(network, txHash) {
    const provider = this.getProvider(network);
    return provider.getTransactionReceipt(txHash);
  }
}

export const blockchain = new BlockchainService();