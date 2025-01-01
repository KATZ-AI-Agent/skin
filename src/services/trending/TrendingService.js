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

      const [dextoolsTokens, dexscreenerPairs] = await Promise.all([
        dextools.fetchTrendingTokens(network),
        dexscreener.getBoostedPairs()
      ]);

      const networkPairs = this.filterPairsByNetwork(dexscreenerPairs, network);
      const combined = this.combineResults(dextoolsTokens, networkPairs);

      const formattedTokens = combined.map(token => this.generateTelegramMessage(token));

      await cacheService.set(cacheKey, formattedTokens, CACHE_DURATION);
      return formattedTokens;
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

      const pairs = await dexscreener.getBoostedPairs();
      const formattedPairs = pairs.map(pair => this.generateTelegramMessage(this.formatPair(pair)));

      await cacheService.set(cacheKey, formattedPairs, CACHE_DURATION);
      return formattedPairs;
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  filterPairsByNetwork(pairs, network) {
    if (!Array.isArray(pairs)) return [];
    return pairs
      .filter(pair => pair.chainId?.toLowerCase() === network?.toLowerCase())
      .map(pair => this.formatPair(pair));
  }

  formatPair(pair) {
    return {
      network: pair.chainId?.toLowerCase() || 'Unknown',
      address: pair.tokenAddress || 'Unknown',
      name: pair.name || 'Unknown',
      description: pair.description || 'No description available.',
      icon: pair.icon || null,
      links: this.formatLinks(pair.links),
      metrics: {
        totalAmount: pair.totalAmount || 'N/A',
        amount: pair.amount || 'N/A'
      },
      dexscreener: {
        url: pair.url || '#',
        header: pair.header || null,
        openGraph: pair.openGraph || null
      }
    };
  }

  formatLinks(links) {
    if (!Array.isArray(links)) return {};
    const formattedLinks = {};
    links.forEach(link => {
      if (link.type) {
        formattedLinks[link.type] = link.url;
      } else if (link.label === 'Website') {
        formattedLinks.website = link.url;
      }
    });
    return formattedLinks;
  }

  combineResults(dextoolsTokens, dexscreenerPairs) {
    const seen = new Set();
    const combined = [];

    dextoolsTokens?.forEach(token => {
      const key = `${token.network}:${token.address}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        combined.push({ ...token, sources: ['dextools'] });
      }
    });

    dexscreenerPairs?.forEach(pair => {
      const key = `${pair.network}:${pair.address}`.toLowerCase();
      if (seen.has(key)) {
        const index = combined.findIndex(t => `${t.network}:${t.address}`.toLowerCase() === key);
        if (index >= 0) {
          combined[index] = {
            ...combined[index],
            ...pair,
            sources: [...new Set([...combined[index].sources, 'dexscreener'])]
          };
        }
      } else {
        seen.add(key);
        combined.push({ ...pair, sources: ['dexscreener'] });
      }
    });

    return combined;
  }

  generateTelegramMessage(token) {
    const {
        network = 'Unknown',
        address = 'Unknown',
        name = 'Unknown',
        description = 'No description available.',
        icon,
        links = {},
        metrics = {},
        dexscreener = {}
    } = token;

    const {
        totalAmount = 'N/A',
        amount = 'N/A'
    } = metrics;

    const message = `
🌟 **[${name !== 'Unknown' ? name : 'Token'}](${dexscreener.url || '#'})**  
_${description}_

🪙 **Address:** [${address}](${dexscreener.url || '#'})  
🔗 **Network:** ${network}  
📊 **Total Supply:** ${totalAmount}  
📈 **Available:** ${amount}

🔗 **Links:**  
${links.website ? `• [Website](${links.website})` : ''}
${links.twitter ? `• [Twitter](${links.twitter})` : ''}
${links.telegram ? `• [Telegram](${links.telegram})` : ''}
    `.trim();

    const images = [];
    if (icon) images.push(icon);
    if (dexscreener.header) images.push(dexscreener.header);
    if (dexscreener.openGraph) images.push(dexscreener.openGraph);

    const buttons = [];
    if (dexscreener.url && this.isValidUrl(dexscreener.url)) {
        buttons.push({ text: 'View on DexScreener', url: dexscreener.url });
    }
    if (links.website && this.isValidUrl(links.website)) {
        buttons.push({ text: 'Website', url: links.website });
    }
    if (links.twitter && this.isValidUrl(links.twitter)) {
        buttons.push({ text: 'Twitter', url: links.twitter });
    }
    if (links.telegram && this.isValidUrl(links.telegram)) {
        buttons.push({ text: 'Telegram', url: links.telegram });
    }

    return { message, buttons, images };
  }

  // Helper function to validate URLs
  isValidUrl(url) {
      try {
          new URL(url);
          return true;
      } catch (e) {
          return false;
      }
  }


  startCacheUpdates() {
    setInterval(async () => {
      try {
        const networks = ['ethereum', 'base', 'solana'];
        for (const network of networks) {
          await this.getTrendingTokens(network);
        }
        await Promise.all([this.getBoostedTokens()]);
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
