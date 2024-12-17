import { openAIService } from './openai.js';
import { TRADING_INTENTS, matchIntent, formatIntentResponse } from './intents.js';
import { dextools } from '../dextools/index.js';
import { timedOrderService } from '../timedOrders.js';
import { priceAlertService } from '../priceAlerts.js';
import { walletService } from '../../services/wallet/index.js';
import { networkState } from '../networkState.js';
import { circuitBreakers } from '../../core/circuit-breaker/index.js';
import { BREAKER_CONFIGS } from '../../core/circuit-breaker/index.js';
import { User } from '../../models/User.js';
import { audioService } from './speech.js';
import axios from 'axios';

class AIService {
  constructor() {
    this.conversationHistory = new Map();
  }

  async processVoiceCommand(audioBuffer, userId) {
    return circuitBreakers.executeWithBreaker(
      'openai',
      async () => {
        const text = await this.convertVoiceToText(audioBuffer);
        const intent = matchIntent(text) || await this.classifyIntent(text);

        const result = await this.processCommand(text, intent, userId);
        const confirmationAudio = await audioService.textToSpeech(`On it sir. Processing your request.. ${text}`);
        const responseAudio = await audioService.textToSpeech(result.text);

        return {
          text: result.text,
          intent: result.intent,
          data: result.data,
          confirmationAudio,
          responseAudio,
        };
      },
      BREAKER_CONFIGS.openai
    );
  }

  async processCommand(text, intent, userId) {
    try {
      const history = this.getHistory(userId);
      history.push({ role: 'user', content: text });

      const result = await this.executeIntent(intent, userId);
      const response = formatIntentResponse(intent, result, userId);

      history.push({ role: 'assistant', content: response });
      this.updateHistory(userId, history);

      return { text: response, intent, data: result };
    } catch (error) {
      console.error('Error processing command:', error);
      throw error;
    }
  }

  async classifyIntent(text) {
    try {
      const response = await openAIService.generateAIResponse(text, 'intent_classification');
      return JSON.parse(response).intent || null;
    } catch (error) {
      console.error('Error classifying intent:', error);
      throw error;
    }
  }
  
  async executeIntent(intent, userId) {
    const network = await networkState.getCurrentNetwork(userId);

    switch (intent.type) {
      case TRADING_INTENTS.TRENDING_CHECK:
        return await dextools.fetchTrendingTokens(network);

      case TRADING_INTENTS.TOKEN_SCAN:
        return await dextools.formatTokenAnalysis(network, intent.token);

      case TRADING_INTENTS.PRICE_ALERT:
        return await this.handlePriceAlert(intent, userId, network);

      case TRADING_INTENTS.TIMED_ORDER:
        return await timedOrderService.createOrder(userId, {
          tokenAddress: intent.token,
          network,
          action: intent.action,
          amount: intent.amount,
          executeAt: new Date(intent.timing),
        });

      case TRADING_INTENTS.QUICK_TRADE:
        return await walletService.executeTrade(network, {
          action: intent.action,
          tokenAddress: intent.token,
          amount: intent.amount,
        });

      case TRADING_INTENTS.GEMS_TODAY:
        return await this.getGemsToday();

      case TRADING_INTENTS.INTERNET_SEARCH:
        return await this.performInternetSearch(intent.query);

      default:
        throw new Error('Unknown intent type');
    }
  }

  async handlePriceAlert(intent, userId, network) {
    if (intent.multiTargets) {
      const alerts = [];
      for (const target of intent.multiTargets) {
        const alert = await priceAlertService.createAlert(userId, {
          tokenAddress: intent.token,
          network,
          targetPrice: target.price,
          condition: 'above',
          swapAction: {
            enabled: true,
            type: 'sell',
            amount: target.percentage + '%',
          },
        });
        alerts.push(alert);
      }
      return alerts;
    } else {
      return await priceAlertService.createAlert(userId, {
        tokenAddress: intent.token,
        network,
        targetPrice: intent.targetPrice,
        condition: intent.action === 'buy' ? 'below' : 'above',
        swapAction: {
          enabled: !!intent.amount,
          type: intent.action,
          amount: intent.amount,
        },
      });
    }
  }

  async performInternetSearch(query) {
    return circuitBreakers.executeWithBreaker(
      'brave',
      async () => {
        try {
          const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
            headers: {
              'X-Subscription-Token': process.env.BRAVE_API_KEY,
            },
            params: {
              q: query,
              format: 'json',
            },
          });

          return response.data.results.slice(0, 5);
        } catch (error) {
          console.error('Error performing internet search:', error);
          throw error;
        }
      },
      BREAKER_CONFIGS.brave
    );
  }

  async getGemsToday() {
    const today = new Date().setHours(0, 0, 0, 0);
    const scan = await GemScan.findOne({ date: today }).lean();
    return scan?.tokens || [];
  }

  isTradingIntent(intentType) {
    return [
      TRADING_INTENTS.QUICK_TRADE,
      TRADING_INTENTS.PRICE_ALERT,
      TRADING_INTENTS.TIMED_ORDER,
    ].includes(intentType);
  }

  getHistory(userId) {
    return this.conversationHistory.get(userId) || [];
  }

  updateHistory(userId, history) {
    const trimmed = history.slice(-10);
    this.conversationHistory.set(userId, trimmed);
  }

  clearHistory(userId) {
    this.conversationHistory.delete(userId);
  }
}

export const aiService = new AIService();
