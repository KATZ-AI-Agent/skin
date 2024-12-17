import { blockchain } from '../../../services/blockchain/index.js';
import { aiService } from '../../../services/ai/index.js';
import { networkState } from '../../../services/networkState.js';

export class LoanHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async handleLoansCommand(chatId, userInfo) {
    const loadingMsg = await this.bot.sendMessage(chatId, '😼 Fetching loan data...');

    try {
      const network = await networkState.getCurrentNetwork(userInfo.id);
      const loans = await blockchain.fetchLoans(userInfo.id);

      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      if (!loans || loans.length === 0) {
        await this.bot.sendMessage(
          chatId,
          `❌ *No loans available on ${networkState.getNetworkDisplay(network)}.*`,
          { parse_mode: 'Markdown' }
        );
        return [];
      }

      await this.showLoansData(chatId, loans, network);

      const keyboard = {
        inline_keyboard: [
          [
            { text: '✅ Analyze Loans', callback_data: 'analyze_loans' },
            { text: '❌ No, thanks', callback_data: '/start' }
          ]
        ]
      };

      await this.bot.sendMessage(
        chatId,
        'Would you like me to analyze these loans for meme investment opportunities?',
        { reply_markup: keyboard }
      );

      return loans;
    } catch (error) {
      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }
      throw new Error(`Failed to fetch loans: ${error.message}`);
    }
  }

  async showLoansData(chatId, loans, network) {
    const message = this.formatLoansMessage(loans, network);
    await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  formatLoansMessage(loans, network) {
    if (!loans || loans.length === 0) {
      return `*No loans available on ${networkState.getNetworkDisplay(network)}.*`;
    }

    const networkExplorer = this.getNetworkExplorer(network);

    return `*Available Loans on ${networkState.getNetworkDisplay(network)}:*\n\n${
      loans.map((loan, index) =>
        `Loan #${index + 1}:\n` +
        `• Collateral: ${loan.collateralAmount} ${loan.collateralToken}\n` +
        `• Loan Amount: ${loan.loanAmount} ${loan.loanToken}\n` +
        `• Repay Amount: ${loan.repayAmountOffered} ${loan.loanToken}\n` +
        `• Duration: ${loan.durationDays} days\n` +
        `• [View on Explorer](${networkExplorer}${loan.contractAddress})`
      ).join('\n\n')
    }`;
  }

  async handleLoanAnalysis(chatId, userInfo, loans) {
    const loadingMsg = await this.bot.sendMessage(chatId, '😼 Analyzing loans...');

    try {
      const prompt = `Analyze these loans for meme investment opportunities: ${JSON.stringify(loans)}`;
      const analysis = await aiService.generateResponse(prompt, 'investment', userInfo.id);

      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      const keyboard = {
        inline_keyboard: [
          [{ text: '🔄 Refresh Loans', callback_data: 'retry_loans' }],
          [{ text: '↩️ Back to Menu', callback_data: '/start' }]
        ]
      };

      await this.bot.sendMessage(chatId, analysis, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      return true;
    } catch (error) {
      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }
      throw new Error(`Failed to analyze loans: ${error.message}`);
    }
  }

  getNetworkExplorer(network) {
    switch (network) {
      case 'ethereum':
        return 'https://etherscan.io/address/';
      case 'base':
        return 'https://basescan.org/address/';
      case 'solana':
        return 'https://solscan.io/account/';
      default:
        throw new Error(`Unsupported network: ${network}`);
    }
  }
}
