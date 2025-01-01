import { User } from '../../models/User.js';
import { ErrorHandler } from '../../core/errors/index.js';

export class TransactionValidator {
  static async validateUserAndWallet(userId) {
    try {
      const user = await User.findByTelegramId(userId.toString());
      if (!user) {
        throw new Error('User not found');
      }

      // Get Solana wallet with autonomous trading enabled
      const solanaWallet = user.wallets.solana?.find(w => w.isAutonomous);
      if (!solanaWallet) {
        throw new Error('No Solana wallet is enabled for autonomous trading');
      }

      // Get user's slippage settings
      const slippage = user.settings.trading.slippage.solana || 3;

      return {
        user,
        wallet: solanaWallet,
        slippage
      };
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  static validateTransaction(tx) {
    if (!tx.id || !tx.network || !tx.userId || !tx.transaction) {
      throw new Error('Invalid transaction format');
    }
  }
}