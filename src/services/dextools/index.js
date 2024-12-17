import { getEvmTokenInfo, getEvmTokenPrice } from './dextoolsService.js';
import { getTokenPrice as getAlchemyTokenPrice } from '../alchemy/alchemyService.js';
import { getSolanaTokenInfo } from '../solana/solanaService.js';
import { dexToolsWebSocket } from './websocket.js';
import { formatTrendingToken, formatAnalysisMessage } from './formatters.js';
import { dextoolsRequest } from '../api/api.js';
import { circuitBreakers } from '../../core/circuit-breaker/index.js';
import { BREAKER_CONFIGS } from '../../core/circuit-breaker/index.js';
import { getNetworkSegment } from '../../utils/network.js';
import { Connection, PublicKey } from '@solana/web3.js';

// Unified method to fetch trending tokens
export async function fetchTrendingTokens(network, userId) {
  return circuitBreakers.executeWithBreaker(
    'dextools',
    async () => fetchHotPools(network),
    BREAKER_CONFIGS.dextools
  );
}

export async function fetchHotPools(network) {
  const networkSegment = getNetworkSegment(network);
  if (!networkSegment) {
    throw new Error(`Unsupported network: ${network}`);
  }

  try {
    const data = await dextoolsRequest(`/ranking/${networkSegment}/hotpools`);
    
    if (!data?.data) {
      throw new Error('Invalid response from DexTools API');
    }

    return data.data
      .filter(token => token.mainToken && token.mainToken.address)
      .slice(0, 10)
      .map(formatTrendingToken(networkSegment));
  } catch (error) {
    console.error(`Error fetching trending tokens for ${network}:`, error);
    throw error;
  }
}

// Unified method to fetch token prices
export async function getTokenPrice(network, tokenAddress, userId) {
  if (network === 'solana') {
    throw new Error('Solana token prices are fetched via DEX APIs, not Alchemy.');
  }
  return circuitBreakers.executeWithBreaker(
    network === 'ethereum' || network === 'base' ? 'alchemy' : 'dextools',
    async () => {
      if (network === 'ethereum' || network === 'base') {
        return getAlchemyTokenPrice(network, tokenAddress, userId);
      }
      return getEvmTokenPrice(network, tokenAddress, userId);
    },
    network === 'ethereum' || network === 'base' ? BREAKER_CONFIGS.alchemy : BREAKER_CONFIGS.dextools
  );
}

// Unified method to fetch token info
export async function getTokenInfo(network, tokenAddress, userId) {
  if (network === 'solana') {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    return circuitBreakers.executeWithBreaker(
      'solana',
      async () => getSolanaTokenInfo(connection, tokenAddress),
      BREAKER_CONFIGS.solana
    );
  }

  return circuitBreakers.executeWithBreaker(
    'dextools',
    async () => getEvmTokenInfo(network, tokenAddress, userId),
    BREAKER_CONFIGS.dextools
  );
}

// Format and analyze token data (EVM networks only)
export async function formatTokenAnalysis(network, tokenAddress, userId) {
  if (network === 'solana') {
    throw new Error('Token analysis is not supported for Solana.');
  }
  return circuitBreakers.executeWithBreaker(
    'dextools',
    async () => {
      const networkSegment = getNetworkSegment(network);
      const poolsEndpoint = `/token/${networkSegment}/${tokenAddress}/pools`;
      const poolsResponse = await getEvmTokenInfo(network, poolsEndpoint, userId);

      if (!poolsResponse?.data?.results?.length) {
        return 'No liquidity pools found for this token.';
      }

      const poolData = poolsResponse.data.results[0];
      const price = await getEvmTokenPrice(network, tokenAddress, userId);

      return {
        poolData,
        price,
      };
    },
    BREAKER_CONFIGS.dextools
  );
}

// WebSocket subscriptions for price updates
export async function subscribeToPriceUpdates(network, tokenAddress, callback) {
  return circuitBreakers.executeWithBreaker(
    'dextools',
    async () => {
      const ws = await dexToolsWebSocket.subscribeToPriceUpdates(network, tokenAddress);
      if (callback) {
        dexToolsWebSocket.on('priceUpdate', (data) => {
          if (data.network === network && data.tokenAddress === tokenAddress) {
            callback(data.price);
          }
        });
      }
      return ws;
    },
    BREAKER_CONFIGS.dextools
  );
}

export async function unsubscribeFromPriceUpdates(network, tokenAddress) {
  return circuitBreakers.executeWithBreaker(
    'dextools',
    async () => {
      dexToolsWebSocket.unsubscribe(network, tokenAddress);
    },
    BREAKER_CONFIGS.dextools
  );
}

// Module export
export const dextools = {
  fetchTrendingTokens,
  getTokenInfo,
  getTokenPrice,
  formatTokenAnalysis,
  subscribeToPriceUpdates,
  unsubscribeFromPriceUpdates,
};
