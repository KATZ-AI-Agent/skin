import OpenAI from 'openai';
import { config } from '../../core/config.js';
import { systemPrompts } from './prompts.js';

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.isConnected = false;
    this.conversationHistory = new Map();
  }

  async testConnection() {
    try {
      await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      });
      this.isConnected = true;
      return true;
    } catch (error) {
      this.isConnected = false;
      error.name = 'OpenAIError';
      console.error('Failed to connect to OpenAI:', error);
      throw error;
    }
  }

  clearConversation(userId) {
    this.conversationHistory.delete(userId);
  }

  async generateAIResponse(input, purpose, userId = null) {
    try {
      if (!this.isConnected) {
        await this.testConnection();
      }

      const messages = this.prepareConversationHistory(userId, purpose, input);

      const response = await this.openai.chat.completions.create({
        model: this.getModel(purpose),
        messages,
        max_tokens: 500,
        temperature: this.getTemperature(purpose),
      });

      const reply = response.choices[0].message;
      this.storeConversationHistory(userId, messages, reply);

      return reply.content;
    } catch (error) {
      console.error('OpenAI API Error:', error);
      this.isConnected = false;
      error.name = 'OpenAIError';
      throw error;
    }
  }

  prepareConversationHistory(userId, purpose, input) {
    let messages = userId ? this.conversationHistory.get(userId) || [] : [];

    if (messages.length === 0) {
      messages.push({
        role: 'system',
        content: systemPrompts[purpose] || systemPrompts.general,
      });
    }

    if (purpose === 'image') {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: "What's in this image?" },
          { type: 'image_url', image_url: input },
        ],
      });
    } else {
      messages.push({
        role: 'user',
        content: input,
      });
    }

    return messages;
  }

  getModel(purpose) {
    if (purpose === 'image') return 'gpt-4-vision-preview';
    if (purpose === 'pdf') return 'gpt-4';
    return 'gpt-3.5-turbo';
  }

  getTemperature(purpose) {
    return purpose === 'text' ? 0.7 : 0.5;
  }

  storeConversationHistory(userId, messages, reply) {
    messages.push(reply);
    if (userId) {
      this.conversationHistory.set(userId, messages);
    }
  }
}

const openAIService = new OpenAIService();
export { openAIService };
