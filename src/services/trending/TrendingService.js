import { EventEmitter } from 'events';
import { dextools } from '../dextools/index.js';
import { dexscreener } from '../dexscreener/index.js';
import { cacheService } from '../cache/CacheService.js';
import { ErrorHandler } from '../../core/errors/index.js';

const CACHE_DURATION = 60000; // 1 minute

class TrendingService extends EventEmitter {
  constructor() {
    super();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    try {
      this.startCacheUpdates();
      this.initialized = true;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async getTrendingTokens(network) {
    const cacheKey = `trending:${network}`;
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached;

      const [dextoolsTokens, dexscreenerTokens] = await Promise.all([
        dextools.fetchTrendingTokens(network),
        dexscreener.getTrendingPairs(),
      ]);

      const combined = this.combineResults(dextoolsTokens, dexscreenerTokens);
      await cacheService.set(cacheKey, combined, CACHE_DURATION);
      return combined;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async getBoostedTokens() {
    const cacheKey = 'trending:boosted';
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached;

      const boosted = await dexscreener.getBoostedPairs();
      await cacheService.set(cacheKey, boosted, CACHE_DURATION);
      return boosted;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async getTopBoostedTokens() {
    const cacheKey = 'trending:topBoosted';
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached;

      const topBoosted = await dexscreener.getTopBoostedPairs();
      await cacheService.set(cacheKey, topBoosted, CACHE_DURATION);
      return topBoosted;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async getTokenProfiles() {
    const cacheKey = 'trending:tokenProfiles';
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached;

      const profiles = await dexscreener.getTokenProfiles();
      await cacheService.set(cacheKey, profiles, CACHE_DURATION);
      return profiles;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async getOrders(chainId, tokenAddress) {
    const cacheKey = `trending:orders:${chainId}:${tokenAddress}`;
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached;

      const orders = await dexscreener.getOrders(chainId, tokenAddress);
      await cacheService.set(cacheKey, orders, CACHE_DURATION);
      return orders;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  combineResults(dextoolsTokens, dexscreenerTokens) {
    const seen = new Set();
    return [...dextoolsTokens, ...dexscreenerTokens].reduce((combined, token) => {
      const key = `${token.network}:${token.address}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push({ ...token, sources: ['dextools', 'dexscreener'] });
      }
      return combined;
    }, []);
  }

  startCacheUpdates() {
    setInterval(async () => {
      try {
        const networks = ['ethereum', 'base', 'solana'];
        for (const network of networks) {
          await this.getTrendingTokens(network);
        }
        await Promise.all([this.getBoostedTokens(), this.getTopBoostedTokens(), this.getTokenProfiles()]);
      } catch (error) {
        await ErrorHandler.handle(error);
      }
    }, CACHE_DURATION);
  }

  cleanup() {
    this.initialized = false;
    this.removeAllListeners();
  }
}

export const trendingService = new TrendingService();
