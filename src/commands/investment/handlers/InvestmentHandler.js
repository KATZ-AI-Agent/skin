import { aiService } from '../../../services/ai/index.js';
import { ErrorHandler } from '../../../core/errors/index.js';

export class InvestmentHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async handleTextAnalysis(chatId, text, userInfo) {
    const loadingMsg = await this.bot.sendMessage(chatId, '🤖 Analyzing your query...');

    try {
      const analysis = await this.generateInvestmentAnalysis(text, userInfo);
      await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      await this.bot.sendMessage(chatId, analysis, { parse_mode: 'Markdown' });
    } catch (error) {
      if (loadingMsg) await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      throw error;
    }
  }

  async handleVoiceAnalysis(chatId, voice, userInfo) {
    const loadingMsg = await this.bot.sendMessage(chatId, '🎤 Processing your voice message...');

    try {
      const transcription = await aiService.transcribeVoice(voice.file_id);
      const analysis = await this.generateInvestmentAnalysis(transcription, userInfo);

      await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      await this.bot.sendMessage(chatId, analysis, { parse_mode: 'Markdown' });
    } catch (error) {
      if (loadingMsg) await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      throw error;
    }
  }

  async generateInvestmentAnalysis(input, userInfo) {
    const decisionGuidelines = `
      Please analyze the following token/project using these key factors:
      - Bubble maps for connections.
      - SPL or deployer wallet holding patterns.
      - LP lock (liquidity provider lock status).
      - Social media presence (Telegram with >800 active users, active Twitter spreading the cashtag).
      - Beware of first-mover advantages (avoid copycat projects). Meme Cults are the shit!
      - Avoid fake volume from bots.
      - Avoid unrealistic wallet holder numbers (e.g., 20,000 holders within 24 hours).
      - Use our KOL check command to verify a tokens X popularity, a good KOL is a good early sign.
    `;
    const prompt = `${decisionGuidelines}\n\nUser Query:\n${input}`;
    return aiService.generateResponse(prompt, 'investment');
  }
}
