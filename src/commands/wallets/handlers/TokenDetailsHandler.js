import { ethers } from 'ethers';
import { walletService } from '../../../services/wallet/index.js';
import { tokenService } from '../../../services/wallet/TokenService.js';
import { networkState } from '../../../services/networkState.js';
import { formatBalance } from '../utils/formatters.js';
import { ErrorHandler } from '../../../core/errors/index.js';
import { User } from '../../../models/User.js';
import { gasEstimationService } from '../../../services/gas/GasEstimationService.js';
import { tokenApprovalService } from '../../../services/tokens/TokenApprovalService.js';


export class TokenDetailsHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async showTokenDetails(chatId, userInfo, tokenData) {
    const loadingMsg = await this.bot.sendMessage(chatId, '🪙 Loading token details...');

    try {
      const [tokenAddress, network] = tokenData.split('_');
      console.log(tokenAddress, ' then ', network);
      
      // First get the user document
      const user = await User.findOne({ telegramId: userInfo.id.toString() });
      if (!user) {
        throw new Error('User not found');
      }

      // Now call getActiveWallet as an instance method
      const wallet = user.getActiveWallet(network);
      if (!wallet) {
        throw new Error(`No active wallet found for ${networkState.getNetworkDisplay(network)}`);
      }

      const token = await tokenService.getTokenInfo(network, tokenAddress);
      let balance;

      if (network === 'solana') {
        const balances = await tokenService.getSolanaTokenBalances(wallet.address);
        const tokenBalance = balances.find(t => t.address === tokenAddress);
        balance = tokenBalance?.balance || '0';
      } else {
        const balances = await tokenService.getEvmTokenBalances(network, wallet.address);
        const tokenBalance = balances.find(t => t.address === tokenAddress);
        balance = tokenBalance?.balance || '0';
      }

      const message = this.formatTokenDetails(token, balance, network);
      const keyboard = this.createTokenActionButtons(token, network, wallet.address);

      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      return true;
    } catch (error) {
      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }
      await ErrorHandler.handle(error, this.bot, chatId);
      throw error;
    }
  }

  formatTokenDetails(token, balance, network) {
    return `*Token Details* 🪙\n\n` +
           `Symbol: ${token.symbol}\n` +
           `Balance: ${formatBalance(balance)}\n` +
           `Address: \`${token.address}\`\n\n` +
           `Network: ${networkState.getNetworkDisplay(network)}`;
  }

  createTokenActionButtons(token, network, walletAddress) {
    const buttons = [];

    // Only show send button for non-zero balances
    if (token.balance !== '0') {
      buttons.push({ text: '📤 Send', callback_data: `send_token_${token.address}_${network}` });
    }

    // Add swap button for all tokens
    buttons.push({ text: '💱 Swap', callback_data: `swap_token_${token.address}_${network}` });

    return {
      inline_keyboard: [
        buttons,
        [{ text: '↩️ Back', callback_data: `wallet_${walletAddress}` }]
      ]
    };
  }

  // Token Approval Methods
  async showGasEstimate(chatId, network, params) {
    try {
      const estimate = await gasEstimationService.estimateGas(network, params);
      const recommended = await gasEstimationService.getRecommendedGasPrices(network);
      
      await this.bot.sendMessage(
        chatId,
        `*Estimated Gas Fees* ⛽\n\n` +
        `Network: ${networkState.getNetworkDisplay(network)}\n` +
        `Gas Limit: ${estimate.gasLimit}\n\n` +
        `*Recommended Gas Prices:*\n` +
        `🐌 Slow: ${recommended.slow}\n` +
        `👌 Standard: ${recommended.standard}\n` +
        `🚀 Fast: ${recommended.fast}\n\n` +
        `Estimated Total Cost: ${estimate.formatted}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleApproval(chatId, userInfo, params) {
    try {
      const approval = await tokenApprovalService.checkAllowance(params.network, params);
      
      if (!approval.hasApproval) {
        const keyboard = {
          inline_keyboard: [[
            { text: '✅ Approve', callback_data: `approve_token_${params.tokenAddress}_${params.network}` },
            { text: '❌ Cancel', callback_data: 'cancel_approval' }
          ]]
        };

        await this.bot.sendMessage(
          chatId,
          '*Token Approval Required* 🔐\n\n' +
          'This token requires approval before trading.\n' +
          'Would you like to approve it now?',
          { 
            parse_mode: 'Markdown',
            reply_markup: keyboard
          }
        );
        return false;
      }
      
      return true;
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
      return false;
    }
  }

  async executeApproval(chatId, userInfo, tokenAddress, network) {
    const loadingMsg = await this.bot.sendMessage(chatId, '🔄 Processing approval...');

    try {
      const user = await User.findOne({ telegramId: userInfo.id.toString() });
      const wallet = user.getActiveWallet(network);

      if (!wallet) {
        throw new Error('No active wallet found');
      }

      // First show gas estimate
      const gasParams = {
        to: tokenAddress,
        from: wallet.address,
        data: '0x095ea7b3' // approve(address,uint256) function signature
      };
      
      await this.showGasEstimate(chatId, network, gasParams);

      // Execute approval
      const result = await tokenApprovalService.approveToken(network, {
        tokenAddress,
        spenderAddress: wallet.address,
        amount: ethers.MaxUint256, // Max approval
        walletAddress: wallet.address
      });

      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }

      await this.bot.sendMessage(
        chatId,
        '✅ *Token Approved Successfully*\n\n' +
        `Transaction Hash: \`${result.hash}\`\n` +
        `Gas Used: ${result.gasUsed}\n` +
        `Effective Gas Price: ${result.effectiveGasPrice}`,
        { parse_mode: 'Markdown' }
      );

      return true;
    } catch (error) {
      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }
      await ErrorHandler.handle(error, this.bot, chatId);
      return false;
    }
  }
}