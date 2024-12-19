import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';


/*======================================================================

          USED BY LOAN SERVICE TO ACCESS SMART CONTRACTS 
          TO BE IMPROVED TO USE QUICKNODE THROUGH WALLET SERVICE

========================================================================*/
export class SolanaProvider {
  constructor(networkConfig) {
    this.connection = new Connection(networkConfig.rpcUrl);
  }

  async getBalance(address) {
    const pubkey = new PublicKey(address);
    return this.connection.getBalance(pubkey);
  }

  async getTokenBalance(address, tokenAddress) {
    const pubkey = new PublicKey(address);
    const tokenPubkey = new PublicKey(tokenAddress);
    
    const tokenAccounts = await this.connection.getTokenAccountsByOwner(
      pubkey,
      { mint: tokenPubkey }
    );

    if (tokenAccounts.value.length === 0) {
      return 0;
    }

    const balance = await this.connection.getTokenAccountBalance(
      tokenAccounts.value[0].pubkey
    );

    return balance.value.amount;
  }

  async estimateGas(transaction) {
    return this.connection.getFeeForMessage(transaction);
  }

  async sendTransaction(signedTransaction) {
    const signature = await this.connection.sendRawTransaction(
      signedTransaction.serialize()
    );
    return signature;
  }

  async getTransactionReceipt(signature) {
    return this.connection.getTransaction(signature);
  }
}