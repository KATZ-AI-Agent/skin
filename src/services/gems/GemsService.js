import { EventEmitter } from 'events';
import { dextools } from '../dextools/index.js';
import { pumpFunService } from '../pumpfun/PumpFunService.js';
import { GemScan } from '../../models/GemScan.js';
import { User } from '../../models/User.js';
import { circuitBreakers } from '../../core/circuit-breaker/index.js';
import { BREAKER_CONFIGS } from '../../core/circuit-breaker/index.js';
import { ErrorHandler } from '../../core/errors/index.js';
import { config } from '../../core/config.js';
import PQueue from 'p-queue';
import { ApifyClient } from 'apify-client';

class GemsService extends EventEmitter {
  constructor() {
    super();
    this.scanQueue = new PQueue({ concurrency: 5 }); // Process up to 5 tokens simultaneously
    this.initialized = false;
    this.scanInterval = null;
    this.apifyClient = new ApifyClient({ token: config.apifyApiKey }); // Use API key from config
    this.metricsCache = new Map(); // Cache for metrics to avoid duplicate API calls
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Schedule periodic scans
      this.scanInterval = setInterval(async () => {
        await this.scanGems().catch((error) => ErrorHandler.handle(error));
      }, 12 * 60 * 1000); // Every 5mins

      // Run an initial scan
      await this.scanGems();

      this.initialized = true;
      this.emit('initialized');
      console.log('✅ GemsService initialized successfully.');
    } catch (error) {
      await ErrorHandler.handle(error);
      this.emit('error', error);
    }
  }

  async scanGems() {
    return circuitBreakers.executeWithBreaker(
      'dextools',
      async () => {
        try {
          console.log('🔍 Fetching trending tokens...');
          const trendingTokens = await this.fetchTrendingTokens();
  
          console.log(`✅ Found ${trendingTokens.length} tokens. Processing...`);
          const uniqueTokens = this.removeDuplicateTokens(trendingTokens);
          const processedTokens = await this.processTokenBatch(uniqueTokens);
  
          // If processedTokens is empty, return uniqueTokens
          if (processedTokens.length === 0) {
            console.warn('⚠️ No tokens were processed. Returning uniqueTokens instead.');
            return uniqueTokens;
          }
  
          const today = new Date().setHours(0, 0, 0, 0);
          const scan = new GemScan({ date: today, tokens: processedTokens });
  
          await scan.save();
          await this.notifyUsers(processedTokens.slice(0, 5));
  
          this.emit('scanComplete', {
            date: today,
            tokenCount: processedTokens.length,
          });
  
          return processedTokens;
        } catch (error) {
          await ErrorHandler.handle(error);
          this.emit('error', error);
  
          // Return uniqueTokens if an error occurs after fetching trending tokens
          if (uniqueTokens?.length) {
            console.warn('⚠️ Returning uniqueTokens due to an error during processing.');
            return uniqueTokens;
          }
          throw error; // Rethrow error if uniqueTokens is not available
        }
      },
      BREAKER_CONFIGS.dextools
    );
  }  

  async fetchTrendingTokens() {
    try {
      const [ethereumTokens, baseTokens, solanaTokens] = await Promise.all([
        dextools.fetchTrendingTokens('ethereum'),
        dextools.fetchTrendingTokens('base'),
        dextools.fetchTrendingTokens('solana'),
      ]);

      const pumpFunTokens = (await pumpFunService.fetchNewTokens()) || [];

      if (!Array.isArray(pumpFunTokens)) {
        console.warn('pumpFunTokens is not iterable. Defaulting to an empty array.');
        return [...ethereumTokens, ...baseTokens, ...solanaTokens];
      }

      return [...ethereumTokens, ...baseTokens, ...solanaTokens, ...pumpFunTokens];
    } catch (error) {
      await ErrorHandler.handle(error);
      console.error('❌ Failed to fetch trending tokens. Returning an empty list.');
      return [];
    }
  }

  async processTokenBatch(tokens) {
    const results = await Promise.allSettled(
      tokens.map((token) => this.scanQueue.add(() => this.processToken(token)))
    );

    // Log failures and return only successful results
    return results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);
  }

  async processToken(token) {
    try {
      const cachedMetrics = this.metricsCache.get(token.address);
      const metrics = cachedMetrics || (await this.getSocialMetrics(token));

      if (!cachedMetrics) {
        this.metricsCache.set(token.address, metrics); // Cache metrics
      }

      const rating = this.calculateRating(metrics);

      return {
        ...token,
        metrics: { ...metrics, rating },
      };
    } catch (error) {
      await ErrorHandler.handle(error);
      console.warn(`⚠️ Failed to process token ${token.symbol}. Skipping.`);
      return null;
    }
  }

  async getSocialMetrics(token) {
    const cashtag = token.symbol.startsWith('$') ? token.symbol : `$${token.symbol}`;

    try {
      console.log(`📊 Fetching Twitter metrics for ${cashtag}...`);
      const input = {
        cashtag,
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        maxItems: 100,
      };

      const run = await this.apifyClient.actor('wHootRXb00ztxCELq').call(input);
      const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();

      // Calculate metrics
      return {
        impressions: items.reduce((sum, t) => sum + (t.impressions || 0), 0),
        retweets: items.reduce((sum, t) => sum + (t.retweets || 0), 0),
        likes: items.reduce((sum, t) => sum + (t.likes || 0), 0),
        tweetCount: items.length,
      };
    } catch (error) {
      await ErrorHandler.handle(error);
      console.error(`❌ Failed to fetch metrics for ${token.symbol}. Returning defaults.`);
      return { impressions: 0, retweets: 0, likes: 0, tweetCount: 0 };
    }
  }

  calculateRating(metrics) {
    const thresholds = {
      impressions: 200,
      retweets: 200,
      likes: 500,
      tweetCount: 150,
    };

    const scores = [
      metrics.impressions / thresholds.impressions,
      metrics.retweets / thresholds.retweets,
      metrics.likes / thresholds.likes,
      metrics.tweetCount / thresholds.tweetCount,
    ];

    const totalScore = scores.reduce((sum, score) => sum + Math.min(score * 2.5, 2.5), 0);

    return Math.round(totalScore * 10) / 10;
  }

  removeDuplicateTokens(tokens) {
    const seen = new Set();
    return tokens.filter((token) => {
      const key = `${token.network}:${token.address}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async notifyUsers(topTokens) {
    try {
      const users = await User.find({ 'settings.notifications.gemsToday': true });

      for (const user of users) {
        this.emit('notification', {
          userId: user.telegramId,
          tokens: topTokens,
        });
      }
    } catch (error) {
      await ErrorHandler.handle(error);
    }
  }

  cleanup() {
    if (this.scanInterval) clearInterval(this.scanInterval);
    this.scanQueue.clear();
    this.metricsCache.clear();
    this.removeAllListeners();
    this.initialized = false;
    console.log('✅ GemsService cleaned up.');
  }
}

export const gemsService = new GemsService();
process.on('SIGINT', () => gemsService.cleanup());
process.on('SIGTERM', () => gemsService.cleanup());
