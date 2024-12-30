import { walletService } from '../wallet/index.js';
import { tokenService } from '../wallet/TokenService.js';
import { tradeService } from '../trading/TradeService.js';
import { aiService } from '../ai/index.js';
import { TRADING_INTENTS } from '../ai/intents.js';
import { formatBalance } from '../../utils/formatters.js';
import { ErrorHandler } from '../../core/errors/index.js';

export class SwapService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;
  }

  async getTokenDetails(userInfo, tokenAddress, walletAddress) {
    const walletInfo = await walletService.getWallet(userInfo.id, walletAddress);
    if (!walletInfo) {
      throw new Error('Wallet not found');
    }

    const token = await tokenService.getTokenInfo(walletInfo.network, tokenAddress);
    const balance = await this.getTokenBalance(walletInfo, tokenAddress, walletAddress);

    return {
      token,
      walletInfo,
      balance
    };
  }

  async getTokenBalance(walletInfo, tokenAddress, walletAddress) {
    if (walletInfo.network === 'solana') {
      const balances = await tokenService.getSolanaTokenBalances(walletAddress);
      const tokenBalance = balances.find(t => t.address === tokenAddress);
      return tokenBalance?.balance || '0';
    } else {
      const balances = await tokenService.getEvmTokenBalances(walletInfo.network, walletAddress);
      const tokenBalance = balances.find(t => t.address === tokenAddress);
      return tokenBalance?.balance || '0';
    }
  }

  async analyzeToken(tokenAddress, network) {
    return aiService.processCommand(
      tokenAddress,
      TRADING_INTENTS.TOKEN_SCAN,
      network
    );
  }

  async executeSwap(swapData) {
    const { network, tokenAddress, walletAddress, amount, direction } = swapData;

    return tradeService.executeTrade(network, {
      action: direction,
      tokenAddress,
      amount,
      walletAddress
    });
  }

  formatSwapDetails(token, balance, direction, amount) {
    return {
      token,
      balance: formatBalance(balance),
      direction,
      amount: formatBalance(amount)
    };
  }
}

export const swapService = new SwapService();