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
  
  export function formatPrice(price) {
    if (!price) return '0.00';
    return Number(price).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    });
  }