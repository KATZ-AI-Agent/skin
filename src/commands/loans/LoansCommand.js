import { BaseCommand } from '../base/BaseCommand.js';
import { LoanHandler } from './handlers/LoanHandler.js';
import { USER_STATES } from '../../core/constants.js';

export class LoansCommand extends BaseCommand {
  constructor(bot) {
    super(bot);
    this.command = '/loans';
    this.description = 'Analyze meme loans';
    this.pattern = /^(\/loans|📊 Vet Meme Loans)$/;
    this.loanHandler = new LoanHandler(bot);
  }

  async execute(msg) {
    const chatId = msg.chat.id;
    try {
      await this.handleLoansCommand(chatId, msg.from);
    } catch (error) {
      await this.showErrorMessage(chatId, error, 'retry_loans');
    }
  }

  async handleLoansCommand(chatId, userInfo) {
    const walletConfigured = await this.validateWallet(chatId);
    if (!walletConfigured) return;

    try {
      const loans = await this.loanHandler.handleLoansCommand(chatId, userInfo);

      if (!loans || loans.length === 0) {
        await this.bot.sendMessage(chatId, '❌ *No loans found.* Try again later or use a different network.', {
          parse_mode: 'Markdown'
        });
        return;
      }

      await this.setUserData(userInfo.id, { pendingLoans: loans });
      await this.setState(userInfo.id, USER_STATES.WAITING_LOAN_ANALYSIS);
    } catch (error) {
      throw new Error(`Failed to handle loans command: ${error.message}`);
    }
  }

  async validateWallet(chatId) {
    try {
      const walletExists = await this.loanHandler.checkWalletConfigured();
      if (!walletExists) {
        const keyboard = this.createKeyboard([
          [
            { text: '⚙️ Configure Wallet', callback_data: 'goto_settings' },
            { text: '↩️ Back to Menu', callback_data: '/start' }
          ]
        ]);
        await this.bot.sendMessage(
          chatId,
          '❌ *Wallet not configured!*\n\nPlease configure your wallet before analyzing loans.',
          { reply_markup: keyboard, parse_mode: 'Markdown' }
        );
        return false;
      }
      return true;
    } catch (error) {
      throw new Error(`Failed to validate wallet: ${error.message}`);
    }
  }

  async handleCallback(query) {
    const chatId = query.message.chat.id;
    const action = query.data;
    const userInfo = query.from;

    try {
      switch (action) {
        case 'analyze_loans':
          const userData = await this.getUserData(userInfo.id);
          await this.loanHandler.handleLoanAnalysis(chatId, userInfo, userData.pendingLoans);
          await this.clearState(userInfo.id);
          break;

        case 'retry_loans':
          await this.handleLoansCommand(chatId, userInfo);
          break;

        case 'goto_settings':
          await this.bot.sendMessage(
            chatId,
            'Please configure your wallet in settings first.',
            {
              reply_markup: {
                inline_keyboard: [[{ text: '⚙️ Go to Settings', callback_data: 'settings' }]]
              }
            }
          );
          break;

        default:
          break;
      }
    } catch (error) {
      await this.showErrorMessage(chatId, error, 'retry_loans');
    }
  }
}
