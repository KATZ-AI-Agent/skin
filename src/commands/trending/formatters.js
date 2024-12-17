import { networkState } from '../../services/networkState.js';

export function formatTrendingTokens(tokens, network) {
  if (!tokens?.length) {
    return 'No trending tokens found. Try again later.';
  }

  return [
    `🔥 *Top Trending Tokens on ${networkState.getNetworkDisplay(network)}*\n`,
    ...formatTokenList(tokens)
  ].join('\n');
}

function formatTokenList(tokens) {
  return tokens.map(token => [
    `${token.rank}. *${token.symbol}*`,
    `• Name: ${token.name}`,
    `• Address: \`${formatAddress(token.address)}\``,
    `• [View on Dextools](${token.dextoolsUrl})\n`
  ].join('\n'));
}

function formatAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}