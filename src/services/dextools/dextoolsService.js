import { dextoolsRequest } from '../api/api.js';
import { getNetworkSegment } from '../../utils/network.js';

export async function getEvmTokenInfo(network, tokenAddress, userId) {
  const networkSegment = getNetworkSegment(network);
  const endpoint = `/token/${networkSegment}/${tokenAddress}`;
  return await dextoolsRequest(endpoint, {}, userId);
}

export async function getEvmTokenPrice(network, tokenAddress, userId) {
  const networkSegment = getNetworkSegment(network);
  const poolsEndpoint = `/token/${networkSegment}/${tokenAddress}/pools`;

  const poolsResponse = await dextoolsRequest(poolsEndpoint, { sort: 'creationTime', order: 'asc' }, userId);

  if (!poolsResponse?.data?.results?.length) {
    throw new Error('No liquidity pools found');
  }

  const poolAddress = poolsResponse.data.results[0].address;
  const priceEndpoint = `/pool/${networkSegment}/${poolAddress}/price`;

  const priceResponse = await dextoolsRequest(priceEndpoint, {}, userId);
  return priceResponse?.price || 0;
}

