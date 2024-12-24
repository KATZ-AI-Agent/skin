import { getEvmTokenInfo, getEvmTokenPrice } from './dextoolsService.js';
import { getTokenPrice as getAlchemyTokenPrice } from '../alchemy/alchemyService.js';
import { getSolanaTokenInfo } from '../solana/solanaService.js';
import { dexToolsWebSocket } from './websocket.js';
import { dextoolsRequest } from '../api/api.js';
import { circuitBreakers } from '../../core/circuit-breaker/index.js';
import { BREAKER_CONFIGS } from '../../core/circuit-breaker/index.js';
import { getNetworkSegment } from '../../utils/network.js';

// Fetch trending tokens (DexTools hot pools)
export async function fetchTrendingTokens(network) {
  const networkSegment = getNetworkSegment(network);
  if (!networkSegment) throw new Error(`Unsupported network: ${network}`);
  
  return circuitBreakers.executeWithBreaker(
    'dextools',
    async () => {
      const data = await dextoolsRequest(`/ranking/${networkSegment}/hotpools`, null);
      if (!data?.data) throw new Error('Invalid response from DexTools API');
      return data.data.map((token) => ({
        name: token.mainToken?.name,
        address: token.mainToken?.address,
        price: token.priceUsd,
      }));
    },
    BREAKER_CONFIGS.dextools
  );
}

// Fetch trending pairs (DexScreener API)
export async function fetchDexScreenerTrendingPairs() {
  return circuitBreakers.executeWithBreaker(
    'dexscreener',
    async () => {
      const response = await dexscreener.getTrendingPairs();
      if (!response?.pairs) throw new Error('Invalid response from DexScreener API');
      return response.pairs.map((pair) => ({
        name: pair.baseToken.name,
        address: pair.baseToken.address,
        price: pair.priceUsd,
        volume: pair.volumeUsd,
      }));
    },
    BREAKER_CONFIGS.dexscreener
  );
}

// Get token price (via Alchemy or DexTools)
export async function getTokenPrice(network, tokenAddress) {
  return circuitBreakers.executeWithBreaker(
    ['ethereum', 'base'].includes(network) ? 'alchemy' : 'dextools',
    async () => {
      if (['ethereum', 'base'].includes(network)) {
        return getAlchemyTokenPrice(network, tokenAddress);
      }
      return getEvmTokenPrice(network, tokenAddress);
    },
    ['ethereum', 'base'].includes(network) ? BREAKER_CONFIGS.alchemy : BREAKER_CONFIGS.dextools
  );
}

// Get token information (DexTools or Solana APIs)
export async function getTokenInfo(network, tokenAddress) {
  if (network === 'solana') {
    return circuitBreakers.executeWithBreaker(
      'solana',
      async () => getSolanaTokenInfo(tokenAddress),
      BREAKER_CONFIGS.solana
    );
  }
  return circuitBreakers.executeWithBreaker(
    'dextools',
    async () => getEvmTokenInfo(network, tokenAddress),
    BREAKER_CONFIGS.dextools
  );
}

// Format and analyze token data (DexTools)
export async function formatTokenAnalysis(network, tokenAddress) {
  console.log(network, ': Network, Txn token address:', tokenAddress);
  if (network === 'solana') throw new Error('Token analysis is not supported for Solana.');
  return circuitBreakers.executeWithBreaker(
    'dextools',
    async () => {
      const poolsResponse = await getEvmTokenInfo(network, tokenAddress);
      if (!poolsResponse?.data?.results?.length) {
        return 'No liquidity pools found for this token.';
      }

      const poolData = poolsResponse.data.results[0];
      const price = await getEvmTokenPrice(network, tokenAddress);

      return {
        poolData,
        price,
      };
    },
    BREAKER_CONFIGS.dextools
  );
}

// Get boosted tokens (DexScreener API)
export async function fetchBoostedTokens() {
  return circuitBreakers.executeWithBreaker(
    'dexscreener',
    async () => {
      const response = await dexscreener.getBoostedPairs();
      if (!response?.boosted) throw new Error('Invalid boosted tokens response');
      return response.boosted.map((token) => ({
        name: token.name,
        address: token.address,
        price: token.priceUsd,
        volume: token.volumeUsd,
      }));
    },
    BREAKER_CONFIGS.dexscreener
  );
}

// Fetch orders for a token (DexScreener API)
export async function fetchOrders(chainId, tokenAddress) {
  return circuitBreakers.executeWithBreaker(
    'dexscreener',
    async () => dexscreener.getOrders(chainId, tokenAddress),
    BREAKER_CONFIGS.dexscreener
  );
}

// Fetch token profiles (DexScreener API)
export async function fetchTokenProfiles() {
  return circuitBreakers.executeWithBreaker(
    'dexscreener',
    async () => dexscreener.getTokenProfiles(),
    BREAKER_CONFIGS.dexscreener
  );
}

// WebSocket subscriptions for live price updates
export async function subscribeToPriceUpdates(network, tokenAddress, callback) {
  return circuitBreakers.executeWithBreaker(
    'dextools',
    async () => {
      const ws = await dexToolsWebSocket.subscribeToPriceUpdates(network, tokenAddress);
      dexToolsWebSocket.on('priceUpdate', (data) => {
        if (data.network === network && data.tokenAddress === tokenAddress) {
          callback(data.price);
        }
      });
      return ws;
    },
    BREAKER_CONFIGS.dextools
  );
}

// Unsubscribe from WebSocket price updates
export async function unsubscribeFromPriceUpdates(network, tokenAddress) {
  return circuitBreakers.executeWithBreaker(
    'dextools',
    async () => dexToolsWebSocket.unsubscribe(network, tokenAddress),
    BREAKER_CONFIGS.dextools
  );
}

// Export all methods
export const dextools = {
  fetchTrendingTokens,
  fetchDexScreenerTrendingPairs,
  fetchBoostedTokens,
  fetchOrders,
  fetchTokenProfiles,
  getTokenPrice,
  getTokenInfo,
  formatTokenAnalysis,
  subscribeToPriceUpdates,
  unsubscribeFromPriceUpdates,
};
