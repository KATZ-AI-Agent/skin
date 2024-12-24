// src/services/wallet/wallets/base.js
export class BaseWallet {
  constructor(networkConfig) {
    this.networkConfig = networkConfig;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      await this.setupProvider();
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error(`Error initializing wallet provider:`, error);
      throw error;
    }
  }

  async setupProvider() {
    throw new Error('setupProvider must be implemented by subclass');
  }

  async createWallet() {
    throw new Error('createWallet must be implemented by subclass');
  }

  async getBalance(address) {
    throw new Error('getBalance must be implemented by subclass');
  }

  async getTokenBalance(address, tokenAddress) {
    throw new Error('getTokenBalance must be implemented by subclass');
  }

  async signTransaction(transaction, privateKey) {
    throw new Error('signTransaction must be implemented by subclass');
  }

  cleanup() {
    // Optional cleanup method to be implemented by subclasses
  }
}