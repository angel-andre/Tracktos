/**
 * Convert array of objects to CSV string
 */
function arrayToCSV(data: any[], headers: string[]): string {
  const csvRows = [];
  
  // Add header row
  csvRows.push(headers.join(','));
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Handle values that contain commas, quotes, or newlines
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

/**
 * Download CSV file
 */
function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export transaction history to CSV
 */
export function exportTransactionsToCSV(transactions: any[]): void {
  const data = transactions.map(tx => ({
    hash: tx.hash,
    type: tx.type,
    success: tx.success ? 'Success' : 'Failed',
    timestamp: new Date(tx.timestamp).toLocaleString(),
  }));
  
  const csv = arrayToCSV(data, ['hash', 'type', 'success', 'timestamp']);
  const filename = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csv, filename);
}

/**
 * Export token holdings to CSV
 */
export function exportTokensToCSV(tokens: any[]): void {
  const data = tokens.map(token => ({
    name: token.name,
    symbol: token.symbol,
    balance: token.balance,
    usdPrice: token.usdPrice,
    usdValue: token.usdValue,
  }));
  
  const csv = arrayToCSV(data, ['name', 'symbol', 'balance', 'usdPrice', 'usdValue']);
  const filename = `token_holdings_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csv, filename);
}

/**
 * Export NFT list to CSV
 */
export function exportNFTsToCSV(nfts: any[]): void {
  const data = nfts.map(nft => ({
    name: nft.name,
    collection: nft.collection,
    image: nft.image,
    price: nft.price || 'N/A',
    tokenDataId: nft.tokenDataId || 'N/A',
  }));
  
  const csv = arrayToCSV(data, ['name', 'collection', 'image', 'price', 'tokenDataId']);
  const filename = `nft_collection_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csv, filename);
}
