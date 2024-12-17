export function getNetworkSegment(network) {
    const networkMap = {
      ethereum: 'ether',
      base: 'base',
      solana: 'solana',
    };
  
    return networkMap[network.toLowerCase()] || 'unknown';
  }
  