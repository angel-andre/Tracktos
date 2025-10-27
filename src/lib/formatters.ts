/**
 * Format a number with commas as thousands separators
 */
export function formatNumber(num: number | string, decimals: number = 2): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '0';
  
  // For very small numbers, use more decimals
  if (n > 0 && n < 0.01) {
    return n.toFixed(6).replace(/\.?0+$/, '');
  }
  
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format crypto token amounts (APT, etc)
 */
export function formatTokenAmount(amount: string | number, symbol: string = ''): string {
  const formatted = formatNumber(amount, 4);
  return symbol ? `${formatted} ${symbol}` : formatted;
}

/**
 * Format large numbers with K, M, B suffixes
 */
export function formatCompactNumber(num: number | string): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '0';
  
  if (n >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(2)}B`;
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(2)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(2)}K`;
  }
  return formatNumber(n, 2);
}

/**
 * Format integer counts
 */
export function formatCount(count: number): string {
  return count.toLocaleString('en-US');
}
