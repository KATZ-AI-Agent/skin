// src/services/network/providers/base.js
export class NetworkProvider {
  constructor() {
    if (new.target === NetworkProvider) {
      throw new Error('NetworkProvider is an abstract class');
    }
  }

  async initialize() {
    try {
      await this.getBlockNumber(); // Test connection
      return true;
    } catch (error) {
      throw error;
    }
  }

  async getBlockNumber() {
    throw new Error('getBlockNumber must be implemented by subclass');
  }

  async getGasPrice(network) {
    throw new Error('getGasPrice must be implemented by subclass');
  }

  async isContractAddress(address) {
    throw new Error('isContractAddress must be implemented by subclass');
  }

  async estimateGas(transaction) {
    throw new Error('estimateGas must be implemented by subclass');
  }

  async sendTransaction(signedTransaction) {
    throw new Error('sendTransaction must be implemented by subclass');
  }

  async getTransactionReceipt(txHash) {
    throw new Error('getTransactionReceipt must be implemented by subclass');
  }

  async validateTransaction(network, transaction) {
    throw new Error('validateTransaction must be implemented by subclass');
  }

  cleanup() {
    // Optional cleanup method to be implemented by subclasses
  }
}
