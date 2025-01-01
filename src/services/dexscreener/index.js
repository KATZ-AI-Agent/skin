import axios from 'axios';
import { cacheService } from '../cache/CacheService.js';
import { ErrorHandler } from '../../core/errors/index.js';

const CACHE_DURATION = 6000; // 1 minute cache
const BASE_URL = 'https://api.dexscreener.com';

class DexScreenerService {
  constructor() {
    this.api = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        'Accept': 'application/json'
      }
    });
  }

  async fetchWithCache(endpoint, params = {}, cacheKey) {
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      console.log(`🔄 Fetching from ${endpoint}`);
      const response = await this.api.get(endpoint, { params });
      const data = response.data;

      await cacheService.set(cacheKey, data, CACHE_DURATION);
      return data;
    } catch (error) {
      console.error(`❌ DexScreener API error (${endpoint}):`, error.message);
      throw error;
    }
  }

  async getTrendingPairs() {
    return this.fetchWithCache('/dex/pairs/trending', {}, 'dexscreener:trending');
  }

  async getBoostedPairs() {
    return this.fetchWithCache('/token-boosts/latest/v1', {}, 'dexscreener:boosted');
  }

  async getTopBoostedPairs() {
    return this.fetchWithCache('/token-boosts/top/v1', {}, 'dexscreener:topBoosted');
  }

  async getPairsByChainAndPair(chainId, pairId) {
    return this.fetchWithCache(`/dex/pairs/${chainId}/${pairId}`, {}, `dexscreener:pairs:${chainId}:${pairId}`);
  }

  async getPairsByToken(tokenAddresses) {
    if (!Array.isArray(tokenAddresses)) {
      tokenAddresses = [tokenAddresses];
    }
    return this.fetchWithCache(`/dex/tokens/${tokenAddresses.join(',')}`, {}, `dexscreener:tokens:${tokenAddresses.join('-')}`);
  }

  formatPair(pair) {
    if (!pair) return null;

    return {
      chainId: pair.chainId,
      tokenAddress: pair.baseToken?.address,
      symbol: pair.baseToken?.symbol,
      name: pair.baseToken?.name,
      priceUsd: pair.priceUsd,
      volume24h: pair.volume?.h24,
      liquidity: pair.liquidity?.usd,
      url: pair.url,
      description: pair.description,
      icon: pair.icon,
      links: pair.links,
      metrics: {
        fdv: pair.fdv,
        pairCreatedAt: pair.pairCreatedAt,
        priceChange24h: pair.priceChange?.h24,
        txns24h: {
          buys: pair.txns?.h24?.buys || 0,
          sells: pair.txns?.h24?.sells || 0
        }
      }
    };
  }

  cleanup() {
    // Nothing to clean up
  }
}

export const dexscreener = new DexScreenerService();