import { BaseCommand } from '../base/BaseCommand.js';
import { MemeAnalysisHandler } from './handlers/MemeAnalysisHandler.js';
import { gemsService } from '../../services/gems/GemsService.js';
import { ScanHandler } from '../scan/handlers/ScanHandler.js';
import { USER_STATES } from '../../core/constants.js';
import { ErrorHandler } from '../../core/errors/index.js';

export class MemeCommand extends BaseCommand {
  constructor(bot, eventHandler) {
    super(bot, eventHandler);
    this.command = '/meme';
    this.description = 'Analyze meme potential and scan tokens';
    this.pattern = /^(\/meme|🎭 Meme Analysis)$/;

    this.analysisHandler = new MemeAnalysisHandler(bot);
    this.scanHandler = new ScanHandler(bot);
    
    this.eventHandler = eventHandler;

    this.registerCallbacks();
  }

  registerCallbacks() {
    this.eventHandler.on('meme_options', this.showMemeOptions.bind(this));
    this.eventHandler.on('meme_scan', this.startGemsScan.bind(this));
    this.eventHandler.on(/^meme_scan_token_/, this.scanIndividualToken.bind(this));
    this.eventHandler.on('meme_voice_search', this.startVoiceSearch.bind(this));
  }

  async execute(msg) {
    const chatId = msg.chat.id;
    try {
      await this.showMemeOptions(chatId);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async showMemeOptions(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '📝 Enter CA or Symbol', callback_data: 'meme_ca' }],
      [{ text: '🎤 Send Voice Message', callback_data: 'meme_voice' }],
      [{ text: '🔍 Scan for Memes', callback_data: 'meme_scan' }],
      [{ text: '🎤 Voice Token Search', callback_data: 'meme_voice_search' }],
      [{ text: '↩️ Back to Menu', callback_data: '/start' }]
    ]);

    try {
      await this.bot.sendMessage(
        chatId,
        '*Meme Analysis* 🎭\n\n' +
          'Choose how to analyze a meme or scan for potential tokens:\n\n' +
          '• Enter Contract Address (CA) or Symbol\n' +
          '• Send a Voice Message\n' +
          '• Scan blockchain for meme tokens\n' +
          '• Voice search for tokens\n\n' +
          '_Get AI-powered insights on meme potential_',
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
    } catch (error) {
      throw new Error(`Failed to show meme options: ${error.message}`);
    }
  }

  async handleCallback(query) {
    const chatId = query.message.chat.id;
    const action = query.data;

    try {
      switch (action) {
        case 'meme_ca':
          await this.setState(query.from.id, USER_STATES.WAITING_MEME_INPUT);
          await this.bot.sendMessage(
            chatId,
            '*Enter Meme Details* 📝\n\n' +
              'Provide either:\n' +
              '• Contract Address (CA)\n' +
              '• Token Symbol\n' +
              '• Meme Name/Description',
            { parse_mode: 'Markdown' }
          );
          return true;

        case 'meme_voice':
          await this.setState(query.from.id, USER_STATES.WAITING_MEME_VOICE);
          await this.bot.sendMessage(
            chatId,
            '*Voice Analysis* 🎤\n\n' +
              'Send a voice message describing the meme:\n\n' +
              '• What is the meme about?\n' +
              '• Why do you think it has potential?\n' +
              '• Current market context?',
            { parse_mode: 'Markdown' }
          );
          return true;

        case 'meme_scan':
          await this.startGemsScan(chatId);
          return true;

        case 'meme_voice_search':
          await this.startVoiceSearch(chatId);
          return true;

        case 'retry_meme':
          await this.showMemeOptions(chatId);
          return true;
      }
    } catch (error) {
      await this.showErrorMessage(chatId, error, 'retry_meme');
    }
    return false;
  }

  async handleInput(msg) {
    const chatId = msg.chat.id;
    const state = await this.getState(msg.from.id);

    if (!state) return false;

    try {
      switch (state) {
        case USER_STATES.WAITING_MEME_INPUT:
          await this.analysisHandler.handleTextAnalysis(chatId, msg.text, msg.from);
          await this.clearState(msg.from.id);
          return true;

        case USER_STATES.WAITING_MEME_VOICE:
          if (msg.voice) {
            await this.analysisHandler.handleVoiceAnalysis(chatId, msg.voice, msg.from);
            await this.clearState(msg.from.id);
            return true;
          }
          break;

        case USER_STATES.WAITING_VOICE_SEARCH:
          if (msg.voice) {
            await this.processVoiceSearch(chatId, msg.voice, msg.from);
            await this.clearState(msg.from.id);
            return true;
          }
          break;
      }
    } catch (error) {
      await this.showErrorMessage(chatId, error);
    }
    return false;
  }

  async startGemsScan(chatId) {
    try {
      const loadingMsg = await this.bot.sendMessage(chatId, '🔍 Scanning for meme tokens...');
      const tokens = await gemsService.scanGems();

      if (!tokens || !tokens.length) {
        await this.bot.editMessageText(
          'No meme tokens found. Try again later.',
          { chat_id: chatId, message_id: loadingMsg.message_id }
        );
        return;
      }

      const tokenButtons = tokens.map(token => [
        { text: `🔍 ${token.name} (${token.symbol})`, callback_data: `meme_scan_token_${token.address}` }
      ]);

      const keyboard = {
        inline_keyboard: [...tokenButtons, [{ text: '↩️ Back', callback_data: 'meme_options' }]]
      };

      await this.bot.editMessageText(
        '*Scan Results* 🔍\n\n' +
          'Here are the meme tokens discovered:\n' +
          'Click on any token to scan it individually.',
        { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: 'Markdown', reply_markup: keyboard }
      );
    } catch (error) {
      await this.showErrorMessage(chatId, error, 'meme_options');
    }
  }

  async scanIndividualToken(query) {
    const chatId = query.message.chat.id;
    const tokenAddress = query.data.replace('meme_scan_token_', '');
    const userInfo = query.from;

    try {
      await this.scanHandler.handleTokenScan(chatId, tokenAddress, userInfo);
    } catch (error) {
      await this.showErrorMessage(chatId, error, 'meme_scan');
    }
  }

  async startVoiceSearch(chatId) {
    try {
      await this.setState(chatId, USER_STATES.WAITING_VOICE_SEARCH);
      await this.bot.sendMessage(
        chatId,
        '*Voice Search* 🎤\n\nSend a voice message describing the token you want to search for. Include:\n' +
          '• Token name\n' +
          '• Any identifiers like symbol or description',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      await this.showErrorMessage(chatId, error);
    }
  }

  async processVoiceSearch(chatId, voice, userInfo) {
    try {
      const transcription = await this.analysisHandler.transcribeVoice(voice);
      const tokens = await gemsService.scanGems();

      const matchingTokens = tokens.filter(
        token =>
          token.name.toLowerCase().includes(transcription.toLowerCase()) ||
          token.symbol.toLowerCase().includes(transcription.toLowerCase())
      );

      if (!matchingTokens.length) {
        await this.bot.sendMessage(chatId, `No tokens matching "${transcription}" found.`);
        return;
      }

      const tokenButtons = matchingTokens.map(token => [
        { text: `🔍 ${token.name} (${token.symbol})`, callback_data: `meme_scan_token_${token.address}` }
      ]);

      const keyboard = {
        inline_keyboard: [...tokenButtons, [{ text: '↩️ Back', callback_data: 'meme_options' }]]
      };

      await this.bot.sendMessage(
        chatId,
        `*Voice Search Results* 🎤\n\nTokens matching "${transcription}":`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
    } catch (error) {
      await this.showErrorMessage(chatId, error);
    }
  }
}
