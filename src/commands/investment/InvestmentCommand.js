import { BaseCommand } from '../base/BaseCommand.js';
import { InvestmentHandler } from './handlers/InvestmentHandler.js';
import { USER_STATES } from '../../core/constants.js';
import { ErrorHandler } from '../../core/errors/index.js';

export class InvestmentCommand extends BaseCommand {
  constructor(bot) {
    super(bot);
    this.command = '/invest';
    this.description = 'Get investment advice';
    this.pattern = /^(\/invest|💰 Investment Advice)$/;
    this.investmentHandler = new InvestmentHandler(bot);
  }

  async execute(msg) {
    const chatId = msg.chat.id;
    try {
      await this.showInvestmentOptions(chatId);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId, 'retry_invest');
    }
  }

  async showInvestmentOptions(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '💭 Ask Investment Question', callback_data: 'invest_input' }],
      [{ text: '🎤 Voice Analysis', callback_data: 'invest_voice' }],
      [{ text: '↩️ Back to Menu', callback_data: '/start' }]
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Investment Advisor* 💰\n\n' +
        'Get expert analysis and advice on:\n\n' +
        '• Token investments\n' +
        '• Market trends\n' +
        '• Risk assessment\n' +
        '• Strategy recommendations\n\n' +
        'Choose your preferred input method:',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  }

  async handleCallback(query) {
    const chatId = query.message.chat.id;
    const action = query.data;

    try {
      switch (action) {
        case 'invest_input':
          await this.setState(query.from.id, USER_STATES.WAITING_INVESTMENT_INPUT);
          await this.bot.sendMessage(
            chatId,
            '*Investment Query* 💭\n\n' +
              'Please describe what you would like advice about:\n\n' +
              '• Specific token or project\n' +
              '• Market sector or trend\n' +
              '• Investment strategy\n' +
              '• Risk analysis',
            { parse_mode: 'Markdown' }
          );
          break;

        case 'invest_voice':
          await this.setState(query.from.id, USER_STATES.WAITING_INVESTMENT_VOICE);
          await this.bot.sendMessage(
            chatId,
            '*Voice Analysis* 🎤\n\n' +
              'Send a voice message describing:\n\n' +
              '• Your investment query\n' +
              '• Market context\n' +
              '• Your goals and risk tolerance',
            { parse_mode: 'Markdown' }
          );
          break;

        case 'retry_invest':
          await this.showInvestmentOptions(chatId);
          break;

        default:
          await this.bot.sendMessage(chatId, '❌ Unrecognized action. Returning to the main menu.');
          await this.showInvestmentOptions(chatId);
      }
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId, 'retry_invest');
    }
  }

  async handleInput(msg) {
    const chatId = msg.chat.id;
    const state = await this.getState(msg.from.id);

    if (!state) return false;

    try {
      switch (state) {
        case USER_STATES.WAITING_INVESTMENT_INPUT:
          await this.investmentHandler.handleTextAnalysis(chatId, msg.text, msg.from);
          await this.clearState(msg.from.id);
          return true;

        case USER_STATES.WAITING_INVESTMENT_VOICE:
          if (msg.voice) {
            await this.investmentHandler.handleVoiceAnalysis(chatId, msg.voice, msg.from);
            await this.clearState(msg.from.id);
            return true;
          }
          break;

        default:
          await this.bot.sendMessage(chatId, '❌ Unrecognized input state. Returning to main menu.');
          await this.clearState(msg.from.id);
      }
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
    return false;
  }
}
