export function formatBalance(balance) {
  const num = parseFloat(balance);
  if (isNaN(num)) return '0';
  
  if (num === 0) return '0';
  if (num < 0.000001) return '<0.000001';
  if (num < 1) return num.toFixed(6);
  if (num < 1000) return num.toFixed(4);
  if (num < 1000000) return `${(num/1000).toFixed(2)}K`;
  return `${(num/1000000).toFixed(2)}M`;
}

export function formatAddress(address) {
  if (!address || address === 'native') return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatWalletAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTokenAmount(amount, decimals = 18) {
  if (!amount) return '0';
  try {
    const num = parseFloat(amount) / Math.pow(10, decimals);
    return formatBalance(num.toString());
  } catch (error) {
    console.error('Error formatting token amount:', error);
    return '0';
  }
}