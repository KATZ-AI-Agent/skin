import { ethers } from 'ethers';
import { Alchemy } from 'alchemy-sdk';


/*======================================================================

          USED BY LOAN SERVICE TO ACCESS SMART CONTRACTS 
          TO BE IMPROVED TO USE ALCHEMY THROUGH WALLET SERVICE

========================================================================*/
export class EVMProvider {
  constructor(networkConfig) {
    this.provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
    this.alchemy = new Alchemy({
      apiKey: networkConfig.alchemyApiKey,
      network: networkConfig.name.toLowerCase()
    });
  }

  async getBalance(address) {
    return this.provider.getBalance(address);
  }

  async getTokenBalance(address, tokenAddress) {
    const contract = new ethers.Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)'],
      this.provider
    );
    return contract.balanceOf(address);
  }

  async estimateGas(transaction) {
    return this.provider.estimateGas(transaction);
  }

  async sendTransaction(signedTransaction) {
    const tx = await this.provider.sendTransaction(signedTransaction);
    return tx.hash;
  }

  async getTransactionReceipt(txHash) {
    return this.provider.getTransactionReceipt(txHash);
  }
}