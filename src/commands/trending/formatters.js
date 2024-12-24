import { networkState } from '../../services/networkState.js';
import { formatTokenUrl } from '../../utils/token/formatters.js';

export function formatTrendingTokens(tokens, network, isBoosted = false) {
  if (!tokens?.length) {
    return 'No trending tokens found. Try again later.';
  }

  const title = isBoosted ? 
    '🚀 *Boosted Tokens*' :
    `🔥 *Top Trending Tokens on ${networkState.getNetworkDisplay(network)}*`;

  const formattedTokens = tokens
    .slice(0, 30) // Paginate to 30 tokens
    .map((token, i) => formatTokenEntry(token, i + 1));

  return [
    title + '\n',
    ...formattedTokens,
    '\n_Data from DexTools & DexScreener_'
  ].join('\n');
}

export function formatAsciiArt(type = 'trending') {
  const art = type === 'boosted' ? BOOSTED_ASCII : TRENDING_ASCII;
  return `<pre><code class="language-ascii" style="color: #555"> ${art}</code></pre>`;
}

const TRENDING_ASCII = `
      ╔════════════════════════════════════════╗
      ║             TRENDING TOKENS            ║
      ║         Powered by KATZ AI Agent       ║
      ╚════════════════════════════════════════╝ `;

const BOOSTED_ASCII = `
      ╔════════════════════════════════════════╗
      ║             BOOSTED TOKENS             ║
      ║            Extra Visibility            ║
      ╚════════════════════════════════════════╝ `;

export function formatTokenEntry(token, index, network) {
  if (!token) return '';

  const dextoolsUrl = formatTokenUrl(token, network);
  const chartLink = dextoolsUrl ? `\n• [View Chart](${dextoolsUrl})` : '';
  
  return [
    `${index + 1}. *${token.symbol || 'Unknown'}*`,
    `• Address: \`${formatAddress(token.address)}\``,
    `• Price: $${formatPrice(token.price)}`,
    `• Volume: $${formatVolume(token.volume24h)}`,
    chartLink,
    '' // Empty line for spacing
  ].filter(Boolean).join('\n');
}

// Helper functions
function formatAddress(address) {
  if (!address) return 'Unknown';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatPrice(price) {
  if (!price) return '0.00';
  return Number(price).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8
  });
}

function formatVolume(volume) {
  if (!volume) return '0';
  return Number(volume).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}
