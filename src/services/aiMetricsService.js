
import { TRADING_INTENTS } from './ai/intents.js';
import { matchIntent, formatIntentResponse } from './ai/intents.js';

class AIMetricsService {
  
  constructor() {
    this.metrics = {
      totalCalls: 0,
      intents: {},
      openai: {
        totalTokens: 0,
        totalCost: '$0.00',
        averageResponseTime: '0s',
      },
      simulatedProviders: {
        claude: { calls: 0, averageResponseTime: null },
        bard: { calls: 0, averageResponseTime: null },
      },
    };

    this.initialized = false; // Tracks whether the service is initialized
  }

  async initialize() {
    if (this.initialized) return; // Avoid redundant initialization

    try {
      this.initializeIntentMetrics();
      this.initialized = true;
      console.log('AIMetricsService initialized successfully.');
    } catch (error) {
      console.error('Error during AIMetricsService initialization:', error);
      throw new Error('Failed to initialize AIMetricsService');
    }
  }

  initializeIntentMetrics() {
    Object.keys(TRADING_INTENTS).forEach((intent) => {
      this.metrics.intents[intent] = {
        count: 0,
        success: 0,
        failures: 0,
      };
    });
  }

  recordIntent(intentName, success = true) {
    if (!this.metrics.intents[intentName]) {
      this.metrics.intents[intentName] = { count: 0, success: 0, failures: 0 };
    }
    this.metrics.intents[intentName].count += 1;
    if (success) {
      this.metrics.intents[intentName].success += 1;
    } else {
      this.metrics.intents[intentName].failures += 1;
    }
    this.metrics.totalCalls += 1;
  }

  updateOpenAIMetrics(tokens, cost, responseTime) {
    this.metrics.openai.totalTokens += tokens;
    this.metrics.openai.totalCost = `$${(
      parseFloat(this.metrics.openai.totalCost.replace('$', '')) + cost
    ).toFixed(2)}`;
    this.metrics.openai.averageResponseTime = responseTime;
  }

  getIntentMetrics() {
    return this.metrics.intents;
  }

  async handleIntent(userInput, data) {
    await this.initialize(); // Ensure service is initialized

    const intent = matchIntent(userInput); // Match intent from user input
    if (!intent) {
      console.warn(`No matching intent found for input: "${userInput}"`);
      return 'I couldn’t understand your request. Could you try rephrasing?';
    }

    try {
      this.recordIntent(intent, true); // Record a successful intent
      return formatIntentResponse(intent, data); // Process intent and format response
    } catch (error) {
      this.recordIntent(intent, false); // Record failed intent handling
      console.error(`Error processing intent "${intent}" for input: "${userInput}"`, error);
      throw error;
    }
  }

  async fetchLiveMetrics() {
    await this.initialize(); // Ensure service is initialized

    return {
      ...this.metrics,
      liveUpdate: new Date().toISOString(),
    };
  }

  /**
   * Health check method for integration with HealthMonitor.
   * Returns the health status of the service.
   */
  async checkHealth() {
    try {
      await this.initialize(); // Ensure the service is initialized
      const metrics = await this.fetchLiveMetrics();
      return {
        status: 'healthy',
        details: metrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error during AIMetricsService health check:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export const aiMetricsService = new AIMetricsService();
