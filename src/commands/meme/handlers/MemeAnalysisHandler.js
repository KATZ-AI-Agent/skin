import { aiService } from '../../../services/ai/index.js';
import { USER_STATES } from '../../../core/constants.js';

export class MemeAnalysisHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async handleTextAnalysis(chatId, text, userInfo) {
    const loadingMsg = await this.bot.sendMessage(chatId, '😼 Analyzing meme...');

    try {
      const analysis = await aiService.generateResponse(text, 'memeCapital', userInfo.id);
      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      const keyboard = {
        inline_keyboard: [[
          { text: '🔄 Analyze Another', callback_data: 'meme_ca' },
          { text: '↩️ Back to Menu', callback_data: '/start' }
        ]]
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
      throw error;
    }
  }

  async handleVoiceAnalysis(chatId, voiceMessage, userInfo) {
    const loadingMsg = await this.bot.sendMessage(chatId, '🎤 Processing voice message...');

    try {
      const result = await aiService.processVoiceCommand(voiceMessage, userInfo.id);
      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      // Send text analysis
      await this.bot.sendMessage(chatId, result.response, {
        parse_mode: 'Markdown'
      });

      // Send voice response
      await this.bot.sendVoice(chatId, result.audio, {
        reply_markup: {
          inline_keyboard: [[
            { text: '🔄 Analyze Another', callback_data: 'meme_voice' },
            { text: '↩️ Back to Menu', callback_data: '/start' }
          ]]
        }
      });

      return true;
    } catch (error) {
      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }
      throw error;
    }
  }
}