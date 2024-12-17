import { alchemyRequest } from '../api/api.js';

export async function getTokenPrice(network, tokenAddress, userId) {
  const chainMap = {
    ethereum: 'eth-mainnet',
    base: 'base-mainnet',
    solana: 'solana-mainnet',
  };

  const networkSegment = chainMap[network.toLowerCase()];
  if (!networkSegment) throw new Error(`Unsupported network: ${network}`);

  const endpoint = `/tokens/${tokenAddress}`;
  const params = {
    addresses: [{ network: networkSegment, address: tokenAddress }],
  };

  const response = await alchemyRequest(endpoint, params, userId);
  return response?.prices?.[0]?.price || 0;
}
