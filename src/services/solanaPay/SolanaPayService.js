// src/services/solanaPay/SolanaPayService.js
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { encodeURL, parseURL, createQR } from '@solana/pay';
import { ErrorHandler } from '../../core/errors/index.js';

class SolanaPayService {
  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL);
  }

  async createPayment(amount, reference, label = 'KATZ! Payment') {
    try {
      const recipient = new PublicKey(process.env.MERCHANT_WALLET);
      const url = encodeURL({
        recipient,
        amount,
        reference,
        label,
        message: 'Payment via KATZ!'
      });

      const qrCode = await createQR(url);
      return { url: url.toString(), qrCode };
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async verifyPayment(signature) {
    try {
      const tx = await this.connection.getTransaction(signature);
      return {
        verified: !!tx?.meta?.err,
        amount: tx?.meta?.postBalances[0] - tx?.meta?.preBalances[0]
      };
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }
}

export const solanaPayService = new SolanaPayService();
