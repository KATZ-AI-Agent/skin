import axios from 'axios';
import { cacheService } from '../cache/CacheService.js';

const CACHE_DURATION = 60000; // 1 minute cache

class DexScreenerService {
  constructor() {
    this.api = axios.create({
      baseURL: 'https://api.dexscreener.com',
      timeout: 30000,
    });
  }

  async fetch(endpoint, cacheKey) {
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const response = await this.api.get(endpoint);
    const data = response.data;

    await cacheService.set(cacheKey, data, CACHE_DURATION);
    return data;
  }

  getTrendingPairs() {
    return this.fetch('/dex/trending', 'dexscreener:trending');
  }

  getBoostedPairs() {
    return this.fetch('/dex/boosted', 'dexscreener:boosted');
  }

  getTopBoostedPairs() {
    return this.fetch('/token-boosts/top/v1', 'dexscreener:topBoosted');
  }

  getTokenProfiles() {
    return this.fetch('/token-profiles/latest/v1', 'dexscreener:tokenProfiles');
  }

  getOrders(chainId, tokenAddress) {
    return this.fetch(`/orders/v1/${chainId}/${tokenAddress}`, `dexscreener:orders:${chainId}:${tokenAddress}`);
  }

  getPairsByChainAndPair(chainId, pairId) {
    return this.fetch(`/latest/dex/pairs/${chainId}/${pairId}`, `dexscreener:pairs:${chainId}:${pairId}`);
  }

  getPairsByToken(tokenAddresses) {
    return this.fetch(`/latest/dex/tokens/${tokenAddresses}`, `dexscreener:pairs:${tokenAddresses}`);
  }

  searchPairs(query) {
    return this.fetch(`/latest/dex/search?q=${encodeURIComponent(query)}`, `dexscreener:search:${query}`);
  }
}

export const dexscreener = new DexScreenerService();
