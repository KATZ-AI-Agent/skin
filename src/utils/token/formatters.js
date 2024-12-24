import { config } from '../../config/index.js';

export function formatTokenUrl(token, network) {
  if (!token?.address) {
    return null;
  }

  // Base dextools URL from config
  const baseUrl = config.dextoolsUri || 'https://www.dextools.io/app';
  
  // Network segment mapping
  const networkSegments = {
    ethereum: 'ether',
    base: 'base',
    solana: 'solana'
  };

  const segment = networkSegments[network] || 'ether';
  
  // Construct URL
  return `${baseUrl}/en/${segment}/pair-explorer/${token.address}`;
}
